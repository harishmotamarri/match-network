import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '../auth/middleware';

const router = Router();

// All routes require authentication
router.get('/me', authenticate, (req, res) => userController.getMe(req, res));
router.patch('/me/profile', authenticate, (req, res) => userController.updateProfile(req, res));
router.patch('/me/availability', authenticate, (req, res) => userController.updateAvailability(req, res));
router.get('/:id', authenticate, (req, res) => userController.getPublicProfile(req, res));

export default router;