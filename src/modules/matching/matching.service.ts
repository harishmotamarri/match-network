import prisma from '../../shared/database/prisma';
import redis from '../../shared/cache/redis';
import logger from '../../shared/logger';
import { fetchCandidates } from './matching.repository';
import { scoreCandidate, RequesterContext } from './scoring';
import { notificationService } from '../notifications/notification.service';

export interface MatchRequest {
    requesterId: string;
    requiredSkillIds: string[];
    connectionType: string;
    note?: string;
    radiusKm?: number;
    experienceLevel?: string;
}

export interface MatchResult {
    userId: string;
    name: string;
    city: string | null;
    matchScore: number;
    availability: string;
    matchingSkills: string[];
    connectionId: string;
    isSuggestion?: boolean;
}

export class MatchingService {

    async findMatches(request: MatchRequest): Promise<MatchResult[]> {
        const {
            requesterId,
            requiredSkillIds,
            connectionType,
            radiusKm = 100,
            experienceLevel,
        } = request;

        logger.info({ requesterId, requiredSkillIds, connectionType }, 'Find matches request received');

        // Check cache first
        const cacheKey = `matches:${requesterId}:${requiredSkillIds.sort().join(',')}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            logger.debug({ requesterId }, 'Returning cached matches');
            return JSON.parse(cached);
        }

        // Get requester profile for context
        const requester = await prisma.user.findUnique({
            where: { id: requesterId },
            include: {
                profile: true,
                interests: { select: { category: true, value: true } },
            },
        });

        if (!requester?.profile) {
            logger.warn({ requesterId }, 'User has no profile — returning empty matches');
            return []; // Profile not set up yet — return empty rather than crashing
        }

        const requesterContext: RequesterContext = {
            requiredSkillIds,
            latitude: requester.profile.latitude,
            longitude: requester.profile.longitude,
            experienceLevel: experienceLevel || requester.profile.experienceLevel,
            radiusKm,
            interests: requester.interests,
        };

        // Fetch and score candidates
        const candidates = await fetchCandidates({
            requesterId,
            requiredSkillIds,
            radiusKm,
            latitude: requester.profile.latitude,
            longitude: requester.profile.longitude,
            experienceLevel,
        });

        logger.info(
            { requesterId, candidateCount: candidates.length, requiredSkillIds },
            'Fetched candidates for scoring'
        );

        if (candidates.length === 0) {
            logger.warn({ requesterId, requiredSkillIds }, 'No candidates found with required skills');
        }

        // Score all candidates
        const scored = candidates
            .map((candidate) => {
                const score = scoreCandidate(candidate, requesterContext);
                logger.debug({ candidateId: candidate.userId, score }, 'Candidate scored');
                return { candidate, score };
            })
            .filter((r) => r.score > 0.1)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        logger.info({ requesterId, scoredCount: scored.length }, 'Candidates scored and filtered');

        // ── FALLBACK: Suggested Users ──────────────────────────────────────────
        // If no exact matches found, try again with loose filters
        if (scored.length === 0) {
            logger.info({ requesterId }, 'No exact matches found — trying loosened fallback');
            const fallbackCandidates = await fetchCandidates({
                ...requesterContext,
                requesterId,
                loosenFilters: true,
                limit: 10
            });

            const fallbackScored = fallbackCandidates
                .map((candidate) => ({
                    candidate,
                    score: scoreCandidate(candidate, requesterContext),
                }))
                .filter((r) => r.score > 0.05) // allow lower threshold for suggestions
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            if (fallbackScored.length > 0) {
                return fallbackScored.map(({ candidate, score }) => {
                    return {
                        userId: candidate.userId,
                        name: candidate.name,
                        city: candidate.city,
                        matchScore: score,
                        availability: candidate.availability,
                        matchingSkills: [], // no matching skills in fallback usually
                        connectionId: '',
                        isSuggestion: true
                    };
                });
            }
            return [];
        }

        if (scored.length === 0) return [];

        // ── FIXED: Don't create connections here — only return results ───────────
        const results: MatchResult[] = scored.map(({ candidate, score }) => {
            const matchingSkillIds = new Set(requiredSkillIds);
            const matchingSkills = candidate.skills
                .filter((s) => matchingSkillIds.has(s.skillId))
                .map((s) => (s as any).skill?.name ?? s.skillId);

            return {
                userId: candidate.userId,
                name: candidate.name,
                city: candidate.city,
                matchScore: score,
                availability: candidate.availability,
                matchingSkills,
                connectionId: '', // ← empty, set when user explicitly connects
            };
        });
        // ── END FIX ───────────────────────────────────────────────────────────────

        // Cache for 15 minutes
        await redis.setex(cacheKey, 900, JSON.stringify(results));

        logger.info(
            { requesterId, matchesFound: results.length },
            'Matching complete'
        );

        return results;
    }

    // Manually create a connection request (direct send, bypassing AI matching)
    async createConnectionRequest(
        requesterId: string,
        receiverId: string,
        connectionType: string,
        matchScore: number,
        note?: string
    ) {
        if (requesterId === receiverId) {
            throw new Error('Cannot connect with yourself');
        }

        // Check receiver exists
        const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
        if (!receiver) {
            throw new Error('Receiver not found');
        }

        // Prevent duplicate pending/accepted connection
        const existing = await prisma.connection.findFirst({
            where: {
                OR: [
                    { requesterId, receiverId },
                    { requesterId: receiverId, receiverId: requesterId },
                ],
                status: { in: ['PENDING', 'ACCEPTED'] },
            },
        });

        if (existing) {
            throw new Error('A connection with this user already exists');
        }

        const connection = await prisma.connection.create({
            data: {
                requesterId,
                receiverId,
                connectionType: connectionType as any,
                matchScore,
                note,
                status: 'PENDING',
                matchedAt: new Date(),
            },
        });

        // Invalidate match cache (ioredis does not support glob in .del, use keys+del)
        const cacheKeys = await redis.keys(`matches:${requesterId}:*`);
        if (cacheKeys.length > 0) await redis.del(...cacheKeys);
        // Notify receiver about new connection request
        const requester = await prisma.user.findUnique({
            where: { id: requesterId },
            select: { name: true },
        });

        const receiverUser = await prisma.user.findUnique({
            where: { id: receiverId },
            select: { phoneNumber: true },
        });

        if (requester && receiverUser) {
            await notificationService.notifyConnectionReceived(
                receiverUser.phoneNumber,
                requester.name,
                note
            );
        }

        return connection;
    }

    // Accept or reject a connection
    async respondToConnection(
        connectionId: string,
        userId: string,
        action: 'ACCEPTED' | 'REJECTED'
    ) {
        const connection = await prisma.connection.findUnique({
            where: { id: connectionId },
        });

        if (!connection) throw new Error('Connection not found');
        if (connection.receiverId !== userId) throw new Error('Not authorised to respond to this connection');
        if (connection.status !== 'PENDING') throw new Error('Connection already responded to');

        const updated = await prisma.connection.update({
            where: { id: connectionId },
            data: {
                status: action,
                respondedAt: new Date(),
            },
            include: {
                requester: { select: { id: true, name: true, phoneNumber: true } },
                receiver: { select: { id: true, name: true, phoneNumber: true } },
            },
        });

        // Clear match cache for both users (ioredis does not support glob in .del)
        const cacheKeys = await redis.keys(`matches:${connection.requesterId}:*`);
        if (cacheKeys.length > 0) await redis.del(...cacheKeys);

        // ── NEW: send WhatsApp notification ──────────────────────────────────────
        if (action === 'ACCEPTED') {
            // Notify requester with acceptor's phone
            await notificationService.notifyConnectionAccepted(
                updated.requester.phoneNumber,
                updated.requester.name,
                updated.receiver.name,
                updated.receiver.phoneNumber   // ← pass phone
            );

            // Also notify acceptor with requester's phone
            await notificationService.notifyAcceptorWithRequesterInfo(
                updated.receiver.phoneNumber,
                updated.receiver.name,
                updated.requester.name,
                updated.requester.phoneNumber
            );
        } else {
            await notificationService.notifyConnectionRejected(
                updated.requester.phoneNumber,
                updated.receiver.name
            );
        }
        // ── END NEW ───────────────────────────────────────────────────────────────

        return updated;
    }

    // Get all connections for a user
    async getMyConnections(userId: string) {
        return prisma.connection.findMany({
            where: {
                OR: [{ requesterId: userId }, { receiverId: userId }],
                status: 'ACCEPTED',
            },
            include: {
                requester: {
                    select: {
                        id: true, name: true, phoneNumber: true,
                        profile: { select: { bio: true, city: true, avatarUrl: true, experienceLevel: true, availability: true } },
                        userSkills: { include: { skill: true } },
                    },
                },
                receiver: {
                    select: {
                        id: true, name: true, phoneNumber: true,
                        profile: { select: { bio: true, city: true, avatarUrl: true, experienceLevel: true, availability: true } },
                        userSkills: { include: { skill: true } },
                    },
                },
            },
            orderBy: { respondedAt: 'desc' },
        });
    }

    // New: Remove a connection
    async removeConnection(connectionId: string, userId: string) {
        const connection = await prisma.connection.findUnique({
            where: { id: connectionId }
        });

        if (!connection) throw new Error('Connection not found');
        if (connection.requesterId !== userId && connection.receiverId !== userId) {
            throw new Error('Not authorised to remove this connection');
        }

        await prisma.connection.delete({ where: { id: connectionId } });

        // Invalidate match cache
        const cacheKeys = await redis.keys(`matches:${userId}:*`);
        if (cacheKeys.length > 0) await redis.del(...cacheKeys);

        return { success: true };
    }

    // Get pending requests (received)
    async getPendingRequests(userId: string) {
        return prisma.connection.findMany({
            where: { receiverId: userId, status: 'PENDING' },
            include: {
                requester: {
                    select: {
                        id: true, name: true,
                        profile: { select: { city: true, avatarUrl: true, experienceLevel: true } },
                        userSkills: {
                            select: {
                                skillId: true,
                                proficiencyLevel: true,
                                skill: { select: { name: true } },  // ← add this
                            }
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ── AI RECOMMENDATIONS ───────────────────────────────────────────────────
    async getSparkRecommendations(userId: string) {
        // Fetch top 5 high-reputation or premium users (excluding self and current connections)
        const candidates = await fetchCandidates({
            requesterId: userId,
            requiredSkillIds: [], // general search
            radiusKm: 500,        // broader radius for AI
            loosenFilters: true,
            limit: 5
        });

        return candidates.map(c => ({
            name: c.name,
            city: c.city,
            skills: c.skills.map((s: any) => s.skill?.name || 'Skill'),
            experience: c.experienceLevel,
            reputation: c.reputationScore
        }));
    }
}

export const matchingService = new MatchingService();