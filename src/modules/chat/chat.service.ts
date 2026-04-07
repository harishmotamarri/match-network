import prisma from '../../shared/database/prisma';
import redis from '../../shared/cache/redis';
import logger from '../../shared/logger';

export interface ChatMessageData {
    senderId: string;
    receiverId: string;
    body: string;
}

export class ChatService {

    async sendMessage(data: ChatMessageData) {
        const { senderId, receiverId, body } = data;

        const message = await prisma.chatMessage.create({
            data: {
                senderId,
                receiverId,
                body,
            },
            include: {
                sender: { select: { name: true } },
                receiver: { select: { phoneNumber: true, name: true } },
            },
        });

        logger.info({ senderId, receiverId }, '💬 Chat message saved');
        return message;
    }

    async getChatHistory(userId1: string, userId2: string, limit = 20) {
        return prisma.chatMessage.findMany({
            where: {
                OR: [
                    { senderId: userId1, receiverId: userId2 },
                    { senderId: userId2, receiverId: userId1 },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async getOnlineStatus(userId: string): Promise<'ONLINE' | 'OFFLINE'> {
        const session = await prisma.botSession.findFirst({
            where: { userId },
            select: { lastActivity: true },
        });

        if (!session) return 'OFFLINE';

        // Consider "Online" if active in the last 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        return session.lastActivity > tenMinutesAgo ? 'ONLINE' : 'OFFLINE';
    }

    async markAsRead(receiverId: string, senderId: string) {
        await prisma.chatMessage.updateMany({
            where: {
                senderId,
                receiverId,
                isRead: false,
            },
            data: { isRead: true },
        });
    }
}

export const chatService = new ChatService();
