import prisma from '../../shared/database/prisma';
import { sendTextMessage } from '../whatsapp/meta.client';
import logger from '../../shared/logger';

export class AdminService {

    // ── STATS ─────────────────────────────────────────────────────────────────
    async getStats() {
        const [
            totalUsers,
            activeUsers,
            totalConnections,
            acceptedConnections,
            pendingConnections,
            totalSkills,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { isActive: true } }),
            prisma.connection.count(),
            prisma.connection.count({ where: { status: 'ACCEPTED' } }),
            prisma.connection.count({ where: { status: 'PENDING' } }),
            prisma.skill.count(),
        ]);

        return {
            totalUsers,
            activeUsers,
            blockedUsers: totalUsers - activeUsers,
            totalConnections,
            acceptedConnections,
            pendingConnections,
            totalSkills,
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