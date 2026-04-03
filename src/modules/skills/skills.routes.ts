import { Router } from 'express';
import { skillsController } from './skills.controller';
import { authenticate } from '../auth/middleware';

const router = Router();

router.get('/', authenticate, (req, res) => skillsController.getAllSkills(req, res));
router.post('/me', authenticate, (req, res) => skillsController.addUserSkill(req, res));
router.delete('/me/:skillId', authenticate, (req, res) => skillsController.removeUserSkill(req, res));
router.get('/me', authenticate, (req, res) => skillsController.getMySkills(req, res));

export default router;