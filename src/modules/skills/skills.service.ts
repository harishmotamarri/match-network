import prisma from '../../shared/database/prisma';
import redis from '../../shared/cache/redis';
import Groq from 'groq-sdk';

export class SkillsService {
    private groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    async sanitizeSkills(rawInput: string): Promise<string[]> {
        if (!rawInput.trim()) return [];

        try {
            const response = await this.groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 150,
                temperature: 0, // Deterministic for validation
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional skill extractor for a networking platform. 
Input: A comma-separated or raw text list of things the user claims are skills.
Task: Extract ONLY valid professional, technical, or soft/hard business skills. 
Rules:
- Remove conversational filler, personal activities (sleeping, eating), or "junk" words.
- Standardize names (e.g. "JS" -> "JavaScript", "coding" -> "Software Development").
- Maximum 10 skills.
- Return ONLY a JSON array of strings. No explanation.
Example: "I know React, Python, and I love sleeping" -> ["React", "Python", "Software Development"]`
                    },
                    {
                        role: 'user',
                        content: rawInput
                    }
                ],
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content || '{}';
            const parsed = JSON.parse(content);
            // The AI might return { "skills": [...] } or similar based on prompt
            const skills = Array.isArray(parsed) ? parsed : (parsed.skills || []);
            
            return skills
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 1 && s.length < 50);
        } catch (err) {
            console.error('Skill sanitization failed, falling back to raw split:', err);
            // Fallback to basic comma split if AI fails
            return rawInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }
    }

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

    async ensureSkillsExist(names: string[]) {
        const skillIds: string[] = [];
        for (let name of names) {
            name = name.trim();
            if (!name) continue;
            
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            if (!slug) continue;

            let skill = await prisma.skill.findUnique({ where: { slug } });
            if (!skill) {
                skill = await prisma.skill.create({
                    data: {
                        name,
                        slug,
                        category: 'Other'
                    }
                });
            }
            skillIds.push(skill.id);
        }
        return skillIds;
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