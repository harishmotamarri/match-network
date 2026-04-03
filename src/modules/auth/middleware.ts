import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../shared/utils/jwt';
import { sendError } from '../../shared/utils/response';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                role: string;
                phone: string;
            };
        }
    }
}

export const authenticate = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(res, 'No token provided', 401);
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyAccessToken(token);
        req.user = payload;
        next();
    } catch {
        return sendError(res, 'Invalid or expired token', 401);
    }
};

export const requireAdmin = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (req.user?.role !== 'ADMIN') {
        return sendError(res, 'Admin access required', 403);
    }
    next();
};

export const requirePremium = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (req.user?.role === 'USER') {
        return sendError(res, 'Premium subscription required', 403);
    }
    next();
};