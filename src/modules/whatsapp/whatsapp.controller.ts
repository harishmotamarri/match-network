import { Request, Response } from 'express';
import { botHandler } from './bot.handler';
import { MessageBuilder } from './message.builder';
import { sendTextMessage, sendInteractiveList, sendInteractiveButtons, markReadAndTyping } from './meta.client';
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

            let text = '';
            if (message.type === 'text') {
                text = message.text.body ?? '';
            } else if (message.type === 'interactive') {
                const interactive = message.interactive;
                if (interactive.type === 'list_reply') {
                    text = interactive.list_reply.id;
                } else if (interactive.type === 'button_reply') {
                    text = interactive.button_reply.id;
                }
            } else {
                await sendTextMessage(
                    message.from,
                    MessageBuilder.unrecognizedType()
                );
                return;
            }

            const from = message.from;           // e.g. "919876543210" — no "+" prefix
            const messageId = message.id;

            logger.info({ from, text, messageId }, 'Meta WA message received');

            // Send read receipt and typing indicator immediately
            if (messageId) {
                markReadAndTyping(messageId).catch(err =>
                    logger.error({ err }, 'Failed to send typing indicator')
                );
            }

            const reply = await botHandler.handle(from, text);

            if (typeof reply === 'string') {
                await sendTextMessage(from, reply);
            } else if (reply && reply.type === 'list') {
                try {
                    await sendInteractiveList(from, reply.text, reply.buttonText, reply.sections);
                } catch (listErr: any) {
                    // Graceful text fallback if interactive list fails
                    let fallbackText = `${reply.text}\n\n`;
                    reply.sections.forEach((sec: any) => {
                        fallbackText += `*${sec.title}*\n`;
                        sec.rows.forEach((row: any) => {
                            fallbackText += `${row.id}. ${row.title}\n`;
                        });
                    });
                    fallbackText += `\n_Reply with a number to proceed_`;
                    await sendTextMessage(from, fallbackText);
                }
            } else if (reply && reply.type === 'buttons') {
                try {
                    await sendInteractiveButtons(from, reply.text, reply.buttons);
                } catch (btnErr: any) {
                    // Graceful text fallback if interactive buttons fail
                    let fallbackText = `${reply.text}\n\n`;
                    reply.buttons.forEach((btn: any, i: number) => {
                        fallbackText += `${i + 1}. ${btn.title}\n`;
                    });
                    fallbackText += `\n_Reply with a number to proceed_`;
                    await sendTextMessage(from, fallbackText);
                }
            }

        } catch (err: any) {
            logger.error({ err }, 'Meta webhook processing error');
        }
    }
}

export const whatsAppController = new WhatsAppController();