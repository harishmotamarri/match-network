import prisma from '../shared/database/prisma';
import logger from '../shared/logger';

export async function cleanupExpiredConnections() {
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours ago

    const result = await prisma.connection.updateMany({
        where: {
            status: 'PENDING',
            createdAt: { lt: cutoff },
        },
        data: { status: 'EXPIRED' },
    });

    logger.info({ count: result.count }, '🧹 Expired pending connections cleaned up');
    return result.count;
}