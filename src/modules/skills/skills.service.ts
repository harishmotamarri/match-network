import prisma from '../../shared/database/prisma';
import redis from '../../shared/cache/redis';

export class SkillsService {
    async getAllSkills(category?: string) {
        const cacheKey = `skills:${category || 'all'}`;
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const skills = await prisma.skill.findMany({
            where: category ? { category } : undefined,
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });

        await redis.setex(cacheKey, 86400, JSON.stringify(skills));
        return skills;
    }

    async addUserSkill(userId: string, skillId: string, proficiencyLevel: number) {
        try {
            const userSkill = await prisma.userSkill.upsert({
                where: { userId_skillId: { userId, skillId } },
                update: { proficiencyLevel },
                create: { userId, skillId, proficiencyLevel },
                include: { skill: true },
            });

            await redis.del(`profile:${userId}`);
            return userSkill;
        } catch (err: any) {
            // Prisma P2003 = foreign key constraint failure (skill no longer exists)
            if (err.code === 'P2003') {
                throw new Error('Skill no longer exists. Please restart profile setup.');
            }
            throw err;
        }
    }

    async removeUserSkill(userId: string, skillId: string) {
        await prisma.userSkill.delete({
            where: { userId_skillId: { userId, skillId } },
        });
        await redis.del(`profile:${userId}`);
        return { message: 'Skill removed' };
    }

    async getMySkills(userId: string) {
        return prisma.userSkill.findMany({
            where: { userId },
            include: { skill: true },
            orderBy: { proficiencyLevel: 'desc' },
        });
    }
}

export const skillsService = new SkillsService();