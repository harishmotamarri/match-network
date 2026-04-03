import prisma from '../../shared/database/prisma';
import redis from '../../shared/cache/redis';
import { ExperienceLevel } from '@prisma/client';

export class UserService {
    async getFullProfile(userId: string) {
        // Try cache first
        const cached = await redis.get(`profile:${userId}`);
        if (cached) return JSON.parse(cached);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                userSkills: {
                    include: { skill: true },
                },
                interests: true,
                subscription: true,
                _count: {
                    select: {
                        sentConnections: { where: { status: 'ACCEPTED' } },
                        receivedConnections: { where: { status: 'ACCEPTED' } },
                    },
                },
            },
        });

        if (user) {
            await redis.setex(`profile:${userId}`, 900, JSON.stringify(user));
        }

        return user;
    }

    async updateProfile(userId: string, data: {
        name?: string;
        bio?: string;
        location?: string;
        city?: string;
        country?: string;
        latitude?: number;
        longitude?: number;
        experienceLevel?: ExperienceLevel;
        socialLinks?: object;
    }) {
        const { name, experienceLevel, ...rest } = data;

        // Build typed profile data object
        const profileData = {
            ...rest,
            ...(experienceLevel !== undefined && { experienceLevel }),
        };

        // Update user name if provided
        if (name) {
            await prisma.user.update({
                where: { id: userId },
                data: { name },
            });
        }

        // Update profile fields
        const profile = await prisma.profile.update({
            where: { userId },
            data: profileData,
        });

        // Invalidate cache
        await redis.del(`profile:${userId}`, `user:${userId}`);

        return profile;
    }

    async updateAvailability(userId: string, status: 'AVAILABLE' | 'BUSY' | 'AWAY') {
        const profile = await prisma.profile.update({
            where: { userId },
            data: { availability: status },
        });

        await redis.del(`profile:${userId}`);
        return profile;
    }

    async getPublicProfile(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId, isActive: true },
            select: {
                id: true,
                name: true,
                profile: {
                    select: {
                        bio: true,
                        city: true,
                        country: true,
                        experienceLevel: true,
                        avatarUrl: true,
                        reputationScore: true,
                        availability: true,
                    },
                },
                userSkills: {
                    include: { skill: true },
                },
            },
        });
    }
}

export const userService = new UserService();