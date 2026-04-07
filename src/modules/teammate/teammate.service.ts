import prisma from '../../shared/database/prisma';
import logger from '../../shared/logger';

export interface CreateTeammateRequest {
    creatorId: string;
    title: string;
    description: string;
    requiredSkills: string[];
}

export class TeammateService {

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
        return prisma.teammateRequest.findMany({
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
    }

    async getRequestById(id: string) {
        return prisma.teammateRequest.findUnique({
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
