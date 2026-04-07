import axios from 'axios';
import { config } from '../../config';
import logger from '../../shared/logger';

export class SMSService {
    /**
     * Send OTP via a standard HTTP SMS Gateway.
     * This is a generic implementation that can be tailored to specific APIs.
     */
    async sendOtp(phoneNumber: string, otp: string): Promise<boolean> {
        // Log locally for development
        logger.info({ phoneNumber, otp }, '📨 Attempting to send SMS OTP');

        const { smsGatewayUrl, smsApiKey, smsSenderId } = config;

        // Fallback to console in development if no gateway is configured
        if (!smsGatewayUrl || !smsApiKey) {
            logger.warn('⚠️ SMS Gateway URL/API Key not set — OTP only available in server logs');
            return false;
        }

        try {
            // Customize this request based on your provider's API (e.g. Gupshup, Twilio, Textlocal)
            // This example uses a common POST structure:
            const message = `🔐 Your Match Network OTP is ${otp}. This code is valid for 5 mins. Do not share it.`;

            const response = await axios.post(smsGatewayUrl, {
                apiKey: smsApiKey,
                sender: smsSenderId,
                to: phoneNumber,
                message: message
            }, {
                timeout: 5000 // 5 second timeout
            });

            if (response.status === 200 || response.data?.status === 'success') {
                logger.info({ phoneNumber }, '✅ SMS OTP delivered successfully');
                return true;
            }

            logger.error({ phoneNumber, data: response.data }, '❌ SMS Gateway error');
            return false;
        } catch (err: any) {
            logger.error({ phoneNumber, err: err.message }, '❌ SMS delivery failed');
            return false;
        }
    }
}

export const smsService = new SMSService();
