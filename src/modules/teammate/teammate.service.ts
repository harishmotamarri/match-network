import prisma from '../../shared/database/prisma';
import logger from '../../shared/logger';

export interface CreateTeammateRequest {
    creatorId: string;
    title: string;
    description: string;
    requiredSkills: string[];
}

export class TeammateService {

    private isSchemaSyncError(err: unknown): boolean {
        const candidate = err as { code?: string; message?: string } | undefined;
        const code = candidate?.code;
        const message = (candidate?.message || '').toLowerCase();

        return (
            code === 'P2021' ||
            code === 'P2022' ||
            (message.includes('teammate_requests') && message.includes('does not exist'))
        );
    }

    async createRequest(data: CreateTeammateRequest) {
        return prisma.teammateRequest.create({
            data: {
                creatorId: data.creatorId,
                title: data.title,
                description: data.description,
                requiredSkills: data.requiredSkills,
            }
        });
    }

    async getActiveRequests(userId?: string) {
        try {
            return await prisma.teammateRequest.findMany({
                where: { status: 'OPEN' },
                include: {
                    creator: {
                        select: {
                            name: true,
                            profile: { select: { city: true } }
                        }
                    },
                    _count: { select: { applications: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (err) {
            if (this.isSchemaSyncError(err)) {
                logger.error({ err }, 'teammate_requests table not ready while fetching active requests');
                return [];
            }
            throw err;
        }
    }

    async getRequestById(id: string) {
        try {
            return await prisma.teammateRequest.findUnique({
                where: { id },
                include: {
                    creator: {
                        select: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                            profile: { select: { city: true, bio: true, experienceLevel: true } }
                        }
                    }
                }
            });
        } catch (err) {
            if (this.isSchemaSyncError(err)) {
                logger.error({ err }, 'teammate_requests table not ready while fetching request by id');
                return null;
            }
            throw err;
        }
    }

    async applyToRequest(requestId: string, applicantId: string, message?: string) {
        // Check if already applied
        const existing = await prisma.teammateApplication.findFirst({
            where: { requestId, applicantId }
        });

        if (existing) return existing;

        return prisma.teammateApplication.create({
            data: {
                requestId,
                applicantId,
                message
            }
        });
    }

    async closeRequest(requestId: string, userId: string) {
        return prisma.teammateRequest.updateMany({
            where: { id: requestId, creatorId: userId },
            data: { status: 'CLOSED' }
        });
    }
}

export const teammateService = new TeammateService();
