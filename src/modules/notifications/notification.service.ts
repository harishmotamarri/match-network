import { sendTextMessage } from '../whatsapp/meta.client';
import { MessageBuilder } from '../whatsapp/message.builder';
import prisma from '../../shared/database/prisma';
import logger from '../../shared/logger';

export class NotificationService {

    async notifyConnectionAccepted(
        requesterPhone: string,
        requesterName: string,
        acceptorName: string,
        acceptorPhone: string
    ): Promise<void> {
        const message =
            `🎉 *${acceptorName}* accepted your connection request!\n\n` +
            `📱 Their WhatsApp: *+${acceptorPhone}*\n\n` +
            `Say hello and start collaborating 🚀`;

        await this.send(requesterPhone, message, 'connection_accepted');
    }

    async notifyReplyReceived(
        receiverPhone: string,
        senderName: string,
        messageContent: string
    ): Promise<void> {
        const message =
            `💬 *Message from ${senderName}* regarding your request:\n\n` +
            `"${messageContent}"\n\n` +
            `_You can reply back by using the Spark Network bot._`;

        await this.send(receiverPhone, message, 'connection_reply');
    }

    async notifyAcceptorWithRequesterInfo(
        acceptorPhone: string,
        acceptorName: string,
        requesterName: string,
        requesterPhone: string
    ): Promise<void> {
        const message =
            `✅ You accepted *${requesterName}*'s connection request!\n\n` +
            `📱 Their WhatsApp: *+${requesterPhone}*\n\n` +
            `Reach out and start the conversation 🚀`;

        await this.send(acceptorPhone, message, 'connection_accepted_self');
    }

    async notifyConnectionRejected(
        requesterPhone: string,
        rejectorName: string
    ): Promise<void> {
        const message =
            `😔 *${rejectorName}* passed on your connection request.\n\n` +
            `Don't worry — keep networking! There are more matches waiting.\n\n` +
            `_Reply *menu* to find new matches._`;

        await this.send(requesterPhone, message, 'connection_rejected');
    }

    async notifyConnectionReceived(
        receiverPhone: string,
        requesterName: string,
        note?: string
    ): Promise<void> {
        const message =
            `📬 *${requesterName}* wants to connect with you on Spark Network!\n\n` +
            (note ? `💬 "${note}"\n\n` : '') +
            `_Reply *menu* → Pending requests to respond._`;

        await this.send(receiverPhone, message, 'connection_received');
    }

    async notifyChatMessage(
        receiverPhone: string,
        senderName: string,
        text: string,
        isInChat: boolean
    ): Promise<void> {
        const message = isInChat
            ? `💬 *${senderName}*: ${text}`
            : MessageBuilder.incomingMessage(senderName, text);

        await this.send(receiverPhone, message, 'chat_message');
    }

    async notifyTeammateApplication(
        posterPhone: string,
        applicantName: string,
        projectName: string
    ): Promise<void> {
        const message =
            `📬 *${applicantName}* applied for your project: *${projectName}*!\n\n` +
            `_Open Teammate Hub → My Posts → View Applications to accept/reject or chat._`;

        await this.send(posterPhone, message, 'teammate_application');
    }

    async notifyTeammateApplicationAccepted(
        applicantPhone: string,
        posterName: string,
        posterPhone: string,
        projectTitle: string
    ): Promise<void> {
        const message =
            `🎉 Your request to join *${projectTitle}* was accepted by *${posterName}*!\n\n` +
            `📱 Their WhatsApp: *+${posterPhone}*\n\n` +
            `_Open Spark and use teammate chat to coordinate next steps._`;

        await this.send(applicantPhone, message, 'teammate_application_accepted');
    }

    async notifyTeammateApplicationRejected(
        applicantPhone: string,
        posterName: string,
        projectTitle: string
    ): Promise<void> {
        const message =
            `ℹ️ Your request to join *${projectTitle}* was declined by *${posterName}*.\n\n` +
            `_Keep exploring active posts in Teammate Hub._`;

        await this.send(applicantPhone, message, 'teammate_application_rejected');
    }

    private async send(
        phone: string,
        message: string,
        type: string
    ): Promise<void> {
        try {
            await sendTextMessage(phone, message);

            // Log to Notification table for audit trail
            const user = await prisma.user.findUnique({
                where: { phoneNumber: phone },
                select: { id: true },
            });

            if (user) {
                await prisma.notification.create({
                    data: {
                        userId: user.id,
                        channel: 'WHATSAPP',
                        type,
                        payload: { phone, message },
                        isSent: true,
                        sentAt: new Date(),
                    },
                });
            }

            logger.info({ phone, type }, '✅ Notification sent');
        } catch (err) {
            // Never crash the main flow if notification fails
            logger.warn({ phone, type, err }, '⚠️ Notification failed — main flow unaffected');
        }
    }
}

export const notificationService = new NotificationService();