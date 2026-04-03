import { Request, Response } from 'express';
import { z } from 'zod';
import { matchingService } from '../matching/matching.service';
import { sendSuccess, sendError } from '../../shared/utils/response';

const findMatchesSchema = z.object({
    requiredSkillIds: z.array(z.string().uuid()).min(1).max(10),
    connectionType: z.enum([
        'COLLABORATION', 'MENTORSHIP', 'JOB',
        'INTERNSHIP', 'INVESTMENT', 'NETWORKING'
    ]),
    locationRadiusKm: z.number().min(1).max(500).optional().default(100),
    experienceLevel: z.enum(['STUDENT', 'JUNIOR', 'MID', 'SENIOR', 'EXPERT']).optional(),
    note: z.string().max(300).optional(),
});

const sendRequestSchema = z.object({
    receiverId: z.string().uuid(),
    connectionType: z.enum([
        'COLLABORATION', 'MENTORSHIP', 'JOB',
        'INTERNSHIP', 'INVESTMENT', 'NETWORKING'
    ]),
    matchScore: z.number().min(0).max(1),
    note: z.string().max(300).optional(),
});

const respondSchema = z.object({
    status: z.enum(['ACCEPTED', 'REJECTED']),
});

export class ConnectionsController {

    // POST /v1/connections/matches — find matches
    async findMatches(req: Request, res: Response) {
        try {
            const body = findMatchesSchema.parse(req.body);
            const matches = await matchingService.findMatches({
                requesterId: req.user!.userId,
                ...body,
            });

            return sendSuccess(res, {
                totalFound: matches.length,
                matches,
            }, `Found ${matches.length} matches`);

        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    // POST /v1/connections/request — send a connection request
    async sendRequest(req: Request, res: Response) {
        try {
            const { receiverId, connectionType, matchScore, note } =
                sendRequestSchema.parse(req.body);

            if (receiverId === req.user!.userId) {
                return sendError(res, 'Cannot connect with yourself');
            }

            const connection = await matchingService.createConnectionRequest(
                req.user!.userId,
                receiverId,
                connectionType,
                matchScore,
                note
            );

            return sendSuccess(res, connection, 'Connection request sent', 201);

        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    // PATCH /v1/connections/:id/respond — accept or reject
    async respond(req: Request, res: Response) {
        try {
            const { status } = respondSchema.parse(req.body);
            const connection = await matchingService.respondToConnection(
                req.params.id as string,
                req.user!.userId,
                status
            );

            return sendSuccess(
                res,
                connection,
                status === 'ACCEPTED' ? '🎉 Connection accepted!' : 'Request rejected'
            );

        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    // GET /v1/connections/mine — all accepted connections
    async getMyConnections(req: Request, res: Response) {
        try {
            const connections = await matchingService.getMyConnections(req.user!.userId);
            return sendSuccess(res, connections);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }

    // GET /v1/connections/pending — requests waiting for your response
    async getPending(req: Request, res: Response) {
        try {
            const pending = await matchingService.getPendingRequests(req.user!.userId);
            return sendSuccess(res, pending);
        } catch (err: any) {
            return sendError(res, err.message);
        }
    }
}

export const connectionsController = new ConnectionsController();