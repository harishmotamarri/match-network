import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticate } from '../auth/middleware';

const router = Router();

// All admin routes require JWT + ADMIN role
router.use(authenticate);
router.use((req: any, res: any, next: any) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
});

router.get('/stats',              adminController.getStats.bind(adminController));
router.get('/users',              adminController.getAllUsers.bind(adminController));
router.patch('/users/:userId/block',   adminController.blockUser.bind(adminController));
router.patch('/users/:userId/unblock', adminController.unblockUser.bind(adminController));
router.post('/broadcast',         adminController.broadcast.bind(adminController));

export default router;