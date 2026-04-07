import prisma from '../../shared/database/prisma';
import redis from '../../shared/cache/redis';
import { generateOtp, saveOtp, verifyOtp } from '../../shared/utils/otp';
import { signAccessToken } from '../../shared/utils/jwt';
import { smsService } from '../notifications/sms.service';
import logger from '../../shared/logger';

export class AuthService {
    // Step 1: Send OTP
    async sendOtp(phoneNumber: string): Promise<{ message: string }> {
        const otp = generateOtp();
        await saveOtp(phoneNumber, otp);

        // Log OTP for development/testing
        logger.info({ phoneNumber, otp }, '📱 OTP generated');
        console.log(`\n🔐 OTP for ${phoneNumber}: ${otp}\n`);

        // Send OTP via Standard SMS
        const delivered = await smsService.sendOtp(phoneNumber, otp);

        if (delivered) {
            logger.info({ phoneNumber }, '✅ OTP sent via Standard SMS');
        } else {
            logger.warn({ phoneNumber }, '⚠️ SMS delivery skipped or failed — OTP is in server logs (dev mode)');
        }

        return { message: 'OTP sent successfully' };
    }

    // Step 2: Verify OTP + issue JWT
    async verifyOtpAndLogin(
        phoneNumber: string,
        otp: string,
        name?: string
    ): Promise<{ token: string; user: { id: string; name: string; phone: string; role: string; isNewUser: boolean }; isNewUser: boolean }> {
        const result = await verifyOtp(phoneNumber, otp);

        if (!result.valid) {
            throw new Error(result.reason || 'Invalid OTP');
        }

        // Find or create user
        let isNewUser = false;
        let user = await prisma.user.findUnique({ where: { phoneNumber } });

        if (!user) {
            isNewUser = true;
            user = await prisma.user.create({
                data: {
                    phoneNumber,
                    name: name || 'User',
                    isVerified: true,
                    profile: { create: {} }, // create blank profile
                    subscription: { create: {} }, // create free subscription
                },
            });
            logger.info({ userId: user.id }, 'New user registered');
        }

        const token = signAccessToken({
            userId: user.id,
            role: user.role,
            phone: user.phoneNumber,
        });

        // Cache user in Redis for fast lookups
        await redis.setex(
            `user:${user.id}`,
            900, // 15 minutes
            JSON.stringify(user)
        );

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phoneNumber,
                role: user.role,
                isNewUser,
            },
            isNewUser,
        };
    }

    // Get cached or fresh user
    async getUser(userId: string) {
        const cached = await redis.get(`user:${userId}`);
        if (cached) return JSON.parse(cached);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (user) {
            await redis.setex(`user:${userId}`, 900, JSON.stringify(user));
        }

        return user;
    }
}

export const authService = new AuthService();