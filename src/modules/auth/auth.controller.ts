import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { sendSuccess, sendError } from '../../shared/utils/response';

const sendOtpSchema = z.object({
    phoneNumber: z.string().min(10).max(15),
});

const verifyOtpSchema = z.object({
    phoneNumber: z.string().min(10).max(15),
    otp: z.string().length(6),
    name: z.string().min(2).optional(),
});

export class AuthController {
    async sendOtp(req: Request, res: Response) {
        try {
            const { phoneNumber } = sendOtpSchema.parse(req.body);
            const result = await authService.sendOtp(phoneNumber);
            return sendSuccess(res, result, 'OTP sent');
        } catch (err: any) {
            return sendError(res, err.message || 'Failed to send OTP');
        }
    }

    async verifyOtp(req: Request, res: Response) {
        try {
            const { phoneNumber, otp, name } = verifyOtpSchema.parse(req.body);
            const result = await authService.verifyOtpAndLogin(phoneNumber, otp, name);
            return sendSuccess(
                res,
                result,
                result.isNewUser ? 'Account created' : 'Login successful',
                result.isNewUser ? 201 : 200
            );
        } catch (err: any) {
            return sendError(res, err.message || 'Verification failed');
        }
    }

    async me(req: Request, res: Response) {
        try {
            const user = await authService.getUser(req.user!.userId);
            if (!user) return sendError(res, 'User not found', 404);
            return sendSuccess(res, user);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }
}

export const authController = new AuthController();