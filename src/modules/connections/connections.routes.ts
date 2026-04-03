import { Router } from 'express';
import { connectionsController } from './connections.controller';
import { authenticate } from '../auth/middleware';

const router = Router();

// All routes protected
router.post('/matches', authenticate, (req, res) => connectionsController.findMatches(req, res));
router.post('/request', authenticate, (req, res) => connectionsController.sendRequest(req, res));
router.patch('/:id/respond', authenticate, (req, res) => connectionsController.respond(req, res));
router.get('/mine', authenticate, (req, res) => connectionsController.getMyConnections(req, res));
router.get('/pending', authenticate, (req, res) => connectionsController.getPending(req, res));

export default router;