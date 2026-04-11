import prisma from '../../shared/database/prisma';
import logger from '../../shared/logger';
import { execSync } from 'node:child_process';

export interface CreateTeammateRequest {
    creatorId: string;
    title: string;
    description: string;
    requiredSkills: string[];
}

export class TeammateService {
    private schemaRecoveryInFlight: Promise<boolean> | null = null;

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

    private async attemptSchemaRecovery(): Promise<boolean> {
        if (this.schemaRecoveryInFlight) {
            return this.schemaRecoveryInFlight;
        }

        this.schemaRecoveryInFlight = (async () => {
            try {
                logger.warn('Detected teammate schema mismatch. Attempting Prisma migration recovery');
                execSync('npx prisma migrate deploy', {
                    cwd: process.cwd(),
                    stdio: 'pipe',
                });
                logger.info('Prisma migration recovery completed for teammate hub');
                return true;
            } catch (err) {
                logger.error({ err }, 'Prisma migration recovery failed for teammate hub');
                return false;
            } finally {
                this.schemaRecoveryInFlight = null;
            }
        })();

        return this.schemaRecoveryInFlight;
    }

    private async runWithSchemaRecovery<T>(
        operationName: string,
        operation: () => Promise<T>,
        onUnavailable: () => T
    ): Promise<T> {
        try {
            return await operation();
        } catch (err) {
            if (!this.isSchemaSyncError(err)) {
                throw err;
            }

            logger.error({ err }, `Schema not ready while attempting to ${operationName}`);

            const recovered = await this.attemptSchemaRecovery();
            if (recovered) {
                try {
                    return await operation();
                } catch (retryErr) {
                    if (!this.isSchemaSyncError(retryErr)) {
                        throw retryErr;
                    }
                    logger.error({ err: retryErr }, `Schema still not ready after recovery while attempting to ${operationName}`);
                }
            }

            return onUnavailable();
        }
    }

    async createRequest(data: CreateTeammateRequest) {
        return this.runWithSchemaRecovery(
            'create teammate request',
            () => prisma.teammateRequest.create({
                data: {
                    creatorId: data.creatorId,
                    title: data.title,
                    description: data.description,
                    requiredSkills: data.requiredSkills,
                }
            }),
            () => {
                throw new Error('TEAMMATE_HUB_UNAVAILABLE');
            }
        );
    }

    async getActiveRequests(userId?: string) {
        return this.runWithSchemaRecovery(
            'fetch active teammate requests',
            () => prisma.teammateRequest.findMany({
                where: userId
                    ? { status: 'OPEN', creatorId: userId }
                    : { status: 'OPEN' },
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
            }),
            () => {
                return [];
            }
        );
    }

    async getRequestById(id: string) {
        return this.runWithSchemaRecovery(
            'fetch teammate request by id',
            () => prisma.teammateRequest.findUnique({
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
            }),
            () => {
                return null;
            }
        );
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

    async removeRequest(requestId: string, userId: string) {
        return this.runWithSchemaRecovery(
            'remove teammate request',
            () => prisma.teammateRequest.deleteMany({
                where: { id: requestId, creatorId: userId }
            }),
            () => {
                return { count: 0 };
            }
        );
    }
}

export const teammateService = new TeammateService();
