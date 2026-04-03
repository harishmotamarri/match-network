import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from './middleware';

const router = Router();

router.post('/otp/send', (req, res) => authController.sendOtp(req, res));
router.post('/otp/verify', (req, res) => authController.verifyOtp(req, res));
router.get('/me', authenticate, (req, res) => authController.me(req, res));

export default router;