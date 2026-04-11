import prisma from '../../shared/database/prisma';
import redis from '../../shared/cache/redis';
import { sendTextMessage } from '../whatsapp/meta.client';
import logger from '../../shared/logger';

export class AdminService {

    private async countLiveUserSessions(): Promise<number> {
        const sessionUserIds = new Set<string>();
        let cursor = '0';

        try {
            do {
                const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'wa:session:*', 'COUNT', 100);
                cursor = nextCursor;

                if (keys.length === 0) continue;

                const sessions = await redis.mget(...keys);
                for (const rawSession of sessions) {
                    if (!rawSession) continue;

                    try {
                        const parsed = JSON.parse(rawSession) as { userId?: string };
                        if (parsed.userId) sessionUserIds.add(parsed.userId);
                    } catch {
                        // Ignore malformed session payloads to keep stats endpoint resilient.
                    }
                }
            } while (cursor !== '0');

            return sessionUserIds.size;
        } catch (err) {
            logger.warn({ err }, 'Failed to read live sessions for admin stats');
            return 0;
        }
    }

    // ── STATS ─────────────────────────────────────────────────────────────────
    async getStats() {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            activeAccounts,
            blockedUsers,
            totalConnections,
            acceptedConnections,
            pendingConnections,
            totalSkills,
            newUsers24h,
            newConnections24h,
            liveUsers,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { isActive: true } }),
            prisma.user.count({ where: { isActive: false } }),
            prisma.connection.count(),
            prisma.connection.count({ where: { status: 'ACCEPTED' } }),
            prisma.connection.count({ where: { status: 'PENDING' } }),
            prisma.skill.count(),
            prisma.user.count({ where: { createdAt: { gte: last24h } } }),
            prisma.connection.count({ where: { createdAt: { gte: last24h } } }),
            this.countLiveUserSessions(),
        ]);

        // Keep "activeUsers" dynamic for dashboards while preserving account-level metrics.
        const activeUsers = liveUsers > 0 ? liveUsers : activeAccounts;

        return {
            totalUsers,
            activeUsers,
            onlineUsers: liveUsers,
            activeAccounts,
            blockedUsers,
            totalConnections,
            acceptedConnections,
            pendingConnections,
            totalSkills,
            newUsers24h,
            newConnections24h,
            generatedAt: now.toISOString(),
        };
    }

    // ── USERS ─────────────────────────────────────────────────────────────────
    async getAllUsers(page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    phoneNumber: true,
                    role: true,
                    isActive: true,
                    isPremium: true,
                    createdAt: true,
                    profile: {
                        select: {
                            city: true,
                            experienceLevel: true,
                            availability: true,
                        },
                    },
                },
            }),
            prisma.user.count(),
        ]);

        return { users, total, page, totalPages: Math.ceil(total / limit) };
    }

    async blockUser(identifier: string) {
        const target = await prisma.user.findFirst({
            where: { OR: [{ id: identifier }, { phoneNumber: identifier }] },
        });
        if (!target) throw new Error('User not found. Try their full phone number or ID.');

        const user = await prisma.user.update({
            where: { id: target.id },
            data: { isActive: false },
            select: { name: true, phoneNumber: true },
        });
        logger.info({ userId: target.id }, 'User blocked by admin');
        return user;
    }

    async unblockUser(identifier: string) {
        const target = await prisma.user.findFirst({
            where: { OR: [{ id: identifier }, { phoneNumber: identifier }] },
        });
        if (!target) throw new Error('User not found. Try their full phone number or ID.');

        const user = await prisma.user.update({
            where: { id: target.id },
            data: { isActive: true },
            select: { name: true, phoneNumber: true },
        });
        logger.info({ userId: target.id }, 'User unblocked by admin');
        return user;
    }

    // ── BROADCAST ─────────────────────────────────────────────────────────────
    async broadcast(adminId: string, title: string, message: string, segment: 'ALL' | 'PREMIUM' | 'ACTIVE') {
        // Fetch target users
        const where: any = { isActive: true };
        if (segment === 'PREMIUM') where.isPremium = true;

        const users = await prisma.user.findMany({
            where,
            select: { id: true, phoneNumber: true, name: true },
        });

        logger.info({ segment, count: users.length }, 'Starting broadcast');

        let sentCount = 0;
        let failCount = 0;

        // Send in batches of 10 to avoid rate limiting
        for (let i = 0; i < users.length; i += 10) {
            const batch = users.slice(i, i + 10);
            await Promise.all(
                batch.map(async (user) => {
                    try {
                        await sendTextMessage(user.phoneNumber, `📢 *${title}*\n\n${message}`);
                        sentCount++;
                    } catch {
                        failCount++;
                    }
                })
            );
            // Small delay between batches
            if (i + 10 < users.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // Log broadcast in DB
        await prisma.broadcastMessage.create({
            data: {
                adminId,
                title,
                body: message,
                targetSegment: segment,
                sentCount,
            },
        });

        logger.info({ sentCount, failCount }, 'Broadcast complete');
        return { sentCount, failCount, total: users.length };
    }
}

export const adminService = new AdminService();