import { Request, Response } from 'express';
import { adminService } from './admin.service';
import logger from '../../shared/logger';

export class AdminController {

    async getStats(req: Request, res: Response) {
        try {
            const stats = await adminService.getStats();
            res.json({ success: true, data: stats });
        } catch (err) {
            logger.error({ err }, 'Admin getStats error');
            res.status(500).json({ success: false, message: 'Failed to get stats' });
        }
    }

    async getAllUsers(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const data = await adminService.getAllUsers(page, limit);
            res.json({ success: true, data });
        } catch (err) {
            logger.error({ err }, 'Admin getAllUsers error');
            res.status(500).json({ success: false, message: 'Failed to get users' });
        }
    }

    async blockUser(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const user = await adminService.blockUser(userId as string);
            res.json({ success: true, message: `${user.name} blocked`, data: user });
        } catch (err) {
            logger.error({ err }, 'Admin blockUser error');
            res.status(500).json({ success: false, message: 'Failed to block user' });
        }
    }

    async unblockUser(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const user = await adminService.unblockUser(userId as string);
            res.json({ success: true, message: `${user.name} unblocked`, data: user });
        } catch (err) {
            logger.error({ err }, 'Admin unblockUser error');
            res.status(500).json({ success: false, message: 'Failed to unblock user' });
        }
    }

    async broadcast(req: Request, res: Response) {
        try {
            const { title, message, segment = 'ALL' } = req.body;

            if (!title || !message) {
                return res.status(400).json({ success: false, message: 'title and message are required' });
            }

            // Use first admin user as sender
            const admin = (req as any).user;
            const result = await adminService.broadcast(admin.userId, title, message, segment);
            res.json({ success: true, data: result });
        } catch (err) {
            logger.error({ err }, 'Admin broadcast error');
            res.status(500).json({ success: false, message: 'Broadcast failed' });
        }
    }
}

export const adminController = new AdminController();