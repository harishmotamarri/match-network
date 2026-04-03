import { Request, Response } from 'express';
import { z } from 'zod';
import { matchingService } from './matching.service';
import { sendSuccess, sendError } from '../../shared/utils/response';

const matchRequestSchema = z.object({
    requiredSkillIds: z.array(z.string().uuid()).min(1, 'At least one skill required'),
    connectionType: z.enum([
        'COLLABORATION', 'MENTORSHIP', 'JOB',
        'INTERNSHIP', 'INVESTMENT', 'NETWORKING',
    ]),
    note: z.string().max(300).optional(),
    radiusKm: z.number().min(5).max(500).default(100),
    experienceLevel: z.enum(['STUDENT', 'JUNIOR', 'MID', 'SENIOR', 'EXPERT']).optional(),
});

const respondSchema = z.object({
    action: z.enum(['ACCEPTED', 'REJECTED']),
});

export class MatchingController {

    async requestMatch(req: Request, res: Response) {
        try {
            const data = matchRequestSchema.parse(req.body);
            const results = await matchingService.findMatches({
                requesterId: req.user!.userId,
                ...data,
            });

            if (results.length === 0) {
                return sendSuccess(res, [], 'No matches found. Try expanding your radius or skills.');
            }

            return sendSuccess(res, results, `Found ${results.length} matches`);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    async respondToConnection(req: Request, res: Response) {
        try {
            const { connectionId } = req.params;
            const { action } = respondSchema.parse(req.body);

            const connection = await matchingService.respondToConnection(
                connectionId as string,
                req.user!.userId,
                action
            );

            return sendSuccess(
                res,
                connection,
                action === 'ACCEPTED' ? '🎉 Connection accepted!' : 'Connection declined'
            );
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    async getMyConnections(req: Request, res: Response) {
        try {
            const connections = await matchingService.getMyConnections(req.user!.userId);
            return sendSuccess(res, connections);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    async getPendingRequests(req: Request, res: Response) {
        try {
            const requests = await matchingService.getPendingRequests(req.user!.userId);
            return sendSuccess(res, requests);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }
}

export const matchingController = new MatchingController();