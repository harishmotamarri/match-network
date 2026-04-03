import prisma from '../../shared/database/prisma';
import { CandidateProfile } from './scoring';

export interface RetrievalFilters {
    requesterId: string;
    requiredSkillIds: string[];
    radiusKm: number;
    latitude?: number | null;
    longitude?: number | null;
    experienceLevel?: string | null;
    limit?: number;
}

export async function fetchCandidates(
    filters: RetrievalFilters
): Promise<CandidateProfile[]> {
    const {
        requesterId,
        requiredSkillIds,
        limit = 200,
    } = filters;

    // Get IDs already connected to (accepted or pending)
    const existingConnections = await prisma.connection.findMany({
        where: {
            OR: [
                { requesterId },
                { receiverId: requesterId },
            ],
            status: { in: ['ACCEPTED', 'PENDING'] },
        },
        select: { requesterId: true, receiverId: true },
    });

    const excludedIds = new Set<string>([requesterId]);
    existingConnections.forEach((c) => {
        excludedIds.add(c.requesterId);
        excludedIds.add(c.receiverId);
    });

    // Fetch candidates who have at least one of the required skills
    const candidates = await prisma.user.findMany({
        where: {
            id: { notIn: [...excludedIds] },
            isActive: true,
            userSkills: requiredSkillIds.length > 0
                ? { some: { skillId: { in: requiredSkillIds } } }
                : undefined,
        },
        include: {
            profile: true,
            userSkills: {
                include: { skill: { select: { name: true } } },
                // skillId and proficiencyLevel come automatically with include
            },
            interests: { select: { category: true, value: true } },
            _count: {
                select: {
                    receivedConnections: { where: { status: 'ACCEPTED' } },
                },
            },
        },
        take: limit,
    });

    // Map to scoring shape
    return candidates
        .filter((u) => u.profile !== null)
        .map((u) => ({
            userId: u.id,
            name: u.name,
            city: u.profile!.city,
            latitude: u.profile!.latitude,
            longitude: u.profile!.longitude,
            experienceLevel: u.profile!.experienceLevel,
            availability: u.profile!.availability,
            reputationScore: u.profile!.reputationScore,
            isPremium: u.isPremium,
            skills: u.userSkills,
            interests: u.interests,
            acceptedConnectionsCount: u._count.receivedConnections,
        }));
}