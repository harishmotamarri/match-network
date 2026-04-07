import axios from 'axios';
import { config } from '../../config';
import logger from '../../shared/logger';

const BASE_URL = `https://graph.facebook.com/v19.0/${config.metaPhoneNumberId}/messages`;

const headers = {
    Authorization: `Bearer ${config.metaWaToken}`,
    'Content-Type': 'application/json',
};

export async function sendTextMessage(to: string, text: string): Promise<void> {
    try {
        await axios.post(
            BASE_URL,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'text',
                text: { body: text, preview_url: false },
            },
            { headers }
        );
    } catch (err: any) {
        logger.error(
            { err: err.response?.data ?? err.message, to },
            'Meta WA send failed'
        );
        throw new Error('Failed to send WhatsApp message');
    }
}

// For future use: send template messages (e.g. connection accepted notification)
export async function sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: object[]
): Promise<void> {
    try {
        await axios.post(
            BASE_URL,
            {
                messaging_product: 'whatsapp',
                to,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: languageCode },
                    components,
                },
            },
            { headers }
        );
    } catch (err: any) {
        logger.error(
            { err: err.response?.data ?? err.message, to },
            'Meta WA template send failed'
        );
        throw new Error('Failed to send template message');
    }
}

export async function sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: { id: string; title: string }[]
): Promise<void> {
    try {
        await axios.post(
            BASE_URL,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: bodyText },
                    action: {
                        buttons: buttons.map((b) => ({
                            type: 'reply',
                            reply: {
                                id: b.id,
                                title: b.title.substring(0, 20),
                            },
                        })),
                    },
                },
            },
            { headers }
        );
    } catch (err: any) {
        const metaError = err.response?.data?.error?.message || err.message;
        logger.error(
            { err: err.response?.data ?? err.message, to },
            'Meta WA send buttons failed'
        );
        throw new Error(`Meta API Error: ${metaError}`);
    }
}

export async function sendInteractiveList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: any[]
): Promise<void> {
    // Sanitize lengths per Meta specifications to firmly prevent API rejection
    const sanitizedButtonText = buttonText.substring(0, 20);
    const sanitizedSections = sections.map((s) => ({
        title: s.title.substring(0, 24),
        rows: s.rows.map((r: any) => ({
            id: r.id,
            title: r.title.substring(0, 24),
            ...(r.description ? { description: r.description.substring(0, 72) } : {})
        }))
    }));

    try {
        await axios.post(
            BASE_URL,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    body: { text: bodyText },
                    action: {
                        button: sanitizedButtonText,
                        sections: sanitizedSections
                    }
                }
            },
            { headers }
        );
    } catch (err: any) {
        const metaError = err.response?.data?.error?.message || err.message;
        logger.error(
            { err: err.response?.data ?? err.message, to },
            'Meta WA send list failed'
        );
        throw new Error(`Meta API Error: ${metaError}`);
    }
}

export async function markReadAndTyping(messageId: string): Promise<void> {
    try {
        await axios.post(
            BASE_URL,
            {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
                typing_indicator: { type: 'text' }
            },
            { headers }
        );
    } catch (err: any) {
        logger.error(
            { err: err.response?.data ?? err.message, messageId },
            'Meta WA mark read and typing failed'
        );
        // We don't throw an error here because typing indicator failure is non-critical
    }
}