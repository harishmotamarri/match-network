import { Request, Response } from 'express';
import { z } from 'zod';
import { skillsService } from './skills.service';
import { sendSuccess, sendError } from '../../shared/utils/response';

const addSkillSchema = z.object({
    skillId: z.string().uuid(),
    proficiencyLevel: z.number().int().min(1).max(5).default(3),
});

export class SkillsController {
    async getAllSkills(req: Request, res: Response) {
        try {
            const { category } = req.query;
            const skills = await skillsService.getAllSkills(category as string);
            return sendSuccess(res, skills);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    async addUserSkill(req: Request, res: Response) {
        try {
            const { skillId, proficiencyLevel } = addSkillSchema.parse(req.body);
            const result = await skillsService.addUserSkill(
                req.user!.userId,
                skillId,
                proficiencyLevel
            );
            return sendSuccess(res, result, 'Skill added', 201);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    async removeUserSkill(req: Request, res: Response) {
        try {
            const result = await skillsService.removeUserSkill(
                req.user!.userId,
                req.params.skillId as string
            );
            return sendSuccess(res, result);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    async getMySkills(req: Request, res: Response) {
        try {
            const skills = await skillsService.getMySkills(req.user!.userId);
            return sendSuccess(res, skills);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }
}

export const skillsController = new SkillsController();