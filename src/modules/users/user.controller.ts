import { Request, Response } from 'express';
import { z } from 'zod';
import { userService } from './user.service';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { ExperienceLevel } from '@prisma/client';

const updateProfileSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    experienceLevel: z.enum(['STUDENT', 'JUNIOR', 'MID', 'SENIOR', 'EXPERT']).transform(v => v as ExperienceLevel).optional(),
    socialLinks: z.object({
        linkedin: z.string().url().optional(),
        github: z.string().url().optional(),
        twitter: z.string().url().optional(),
        website: z.string().url().optional(),
    }).optional(),
});

const availabilitySchema = z.object({
    status: z.enum(['AVAILABLE', 'BUSY', 'AWAY']),
});

export class UserController {
    async getMe(req: Request, res: Response) {
        try {
            const user = await userService.getFullProfile(req.user!.userId);
            if (!user) return sendError(res, 'User not found', 404);
            return sendSuccess(res, user);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    async updateProfile(req: Request, res: Response) {
        try {
            const data = updateProfileSchema.parse(req.body);
            const profile = await userService.updateProfile(req.user!.userId, data);
            return sendSuccess(res, profile, 'Profile updated');
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    async updateAvailability(req: Request, res: Response) {
        try {
            const { status } = availabilitySchema.parse(req.body);
            const profile = await userService.updateAvailability(req.user!.userId, status);
            return sendSuccess(res, profile, 'Availability updated');
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    async getPublicProfile(req: Request, res: Response) {
        try {
            const user = await userService.getPublicProfile(req.params.id as string);
            if (!user) return sendError(res, 'User not found', 404);
            return sendSuccess(res, user);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }
}

export const userController = new UserController();