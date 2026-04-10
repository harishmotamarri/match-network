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
                max_tokens: 200,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: `You are a strict professional skill validator for a networking platform.
Input: A text string the user claims contains skills.
Task: Extract ONLY genuine professional, technical, or business skills from the input.
Rules:
- STRICT: Do NOT invent or infer skills not explicitly mentioned. If something is not clearly a skill, exclude it.
- Standardize names (e.g. "JS" -> "JavaScript", "ML" -> "Machine Learning").
- Maximum 10 skills.
- If the input contains NO valid professional skills at all, return {"skills": []}.
- Do NOT include job titles, project names, startup names, vague phrases like "co-founder" as skills.
- Return ONLY a JSON object with key "skills" containing an array of strings. No explanation.
Example: "I know React, Python, and I love sleeping" -> {"skills": ["React", "Python"]}
Example: "AI startup co-founder" -> {"skills": []}`
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
            const skills = Array.isArray(parsed) ? parsed : (parsed.skills || []);

            return skills
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 1 && s.length < 60);
        } catch (err) {
            console.error('Skill sanitization failed, falling back to raw split:', err);
            return rawInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }
    }

    /**
     * Strict skill validator for teammate posts. Rejects irrelevant inputs clearly.
     * Returns { valid: string[], irrelevant: string[] }
     */
    async validateTeammateSkills(rawInput: string): Promise<{ valid: string[]; irrelevant: string[] }> {
        if (!rawInput.trim()) return { valid: [], irrelevant: [] };

        try {
            const response = await this.groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 300,
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: `You are a strict skill validator for a startup/hackathon co-founder platform.
The user is listing REQUIRED SKILLS for a project post (what skills they need in a teammate).
Input: A comma-separated list of skills entered by the user.
Task: Classify each item as either a valid professional/technical skill or irrelevant.
Rules:
- VALID: specific technical skills (React, Python, ML), business skills (Marketing, Finance), design skills (UI/UX, Figma).
- IRRELEVANT: job titles ("Developer", "Co-founder"), vague phrases ("startup experience"), project names, personality traits.
- Standardize valid skill names ("JS" -> "JavaScript", "ML" -> "Machine Learning").
- Return JSON: {"valid": [...], "irrelevant": [...]}
Example input: "React, co-founder, Python, startup experience"
Example output: {"valid": ["React", "Python"], "irrelevant": ["co-founder", "startup experience"]}`
                    },
                    { role: 'user', content: rawInput }
                ],
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content || '{}';
            const parsed = JSON.parse(content);

            const valid = (Array.isArray(parsed.valid) ? parsed.valid : []).map((s: string) => s.trim()).filter((s: string) => s.length > 1);
            const irrelevant = (Array.isArray(parsed.irrelevant) ? parsed.irrelevant : []).map((s: string) => s.trim()).filter((s: string) => s.length > 0);

            return { valid, irrelevant };
        } catch (err) {
            console.error('Teammate skill validation failed:', err);
            // Fallback: treat all as valid
            const fallback = rawInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
            return { valid: fallback, irrelevant: [] };
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