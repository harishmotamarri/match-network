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