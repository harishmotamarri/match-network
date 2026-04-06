import { Request, Response } from 'express';
import { botHandler } from './bot.handler';
import { sendTextMessage, markReadAndTyping } from './meta.client';
import { config } from '../../config';
import logger from '../../shared/logger';

export class WhatsAppController {

    // ── GET /v1/whatsapp/webhook — Meta verification handshake ──────────────────
    verify(req: Request, res: Response) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === config.metaVerifyToken) {
            logger.info('Meta webhook verified');
            return res.status(200).send(challenge);
        }

        logger.warn('Meta webhook verification failed');
        return res.sendStatus(403);
    }

    // ── POST /v1/whatsapp/webhook — Incoming messages ───────────────────────────
    async receive(req: Request, res: Response) {
        // Always respond 200 immediately — Meta will retry if you don't
        res.sendStatus(200);

        try {
            const body = req.body;

            if (body.object !== 'whatsapp_business_account') return;

            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            // Ignore status updates (delivered, read, etc.)
            if (!value?.messages) return;

            const message = value.messages[0];

            // Only handle text messages for now
            if (message.type !== 'text') {
                await sendTextMessage(
                    message.from,
                    `Sorry, I can only process text messages right now. Please type *menu* to start.`
                );
                return;
            }

            const from = message.from;           // e.g. "919876543210" — no "+" prefix
            const text = message.text.body ?? '';
            const messageId = message.id;

            logger.info({ from, text, messageId }, 'Meta WA message received');

            // Send read receipt and typing indicator immediately
            if (messageId) {
                markReadAndTyping(messageId).catch(err => 
                    logger.error({err}, 'Failed to send typing indicator')
                );
            }

            const reply = await botHandler.handle(from, text);

            await sendTextMessage(from, reply);

        } catch (err: any) {
            logger.error({ err }, 'Meta webhook processing error');
        }
    }
}

export const whatsAppController = new WhatsAppController();