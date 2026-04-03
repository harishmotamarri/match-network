import { Router } from 'express';
import { matchingController } from './matching.controller';
import { authenticate } from '../auth/middleware';

const router = Router();

// All routes require auth
router.use(authenticate);

// POST /v1/connections/request → run matching, create pending connections
router.post('/request', (req, res) =>
    matchingController.requestMatch(req, res)
);

// GET /v1/connections → my accepted connections
router.get('/', (req, res) =>
    matchingController.getMyConnections(req, res)
);

// GET /v1/connections/pending → requests waiting for my response
router.get('/pending', (req, res) =>
    matchingController.getPendingRequests(req, res)
);

// POST /v1/connections/:connectionId/respond → accept or reject
router.post('/:connectionId/respond', (req, res) =>
    matchingController.respondToConnection(req, res)
);

export default router;