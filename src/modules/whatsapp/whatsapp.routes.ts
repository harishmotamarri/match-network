import { Router } from 'express';
import { whatsAppController } from './whatsapp.controller';

const router = Router();

// Meta webhook verification (GET)
router.get('/webhook', (req, res) => whatsAppController.verify(req, res));

// Incoming messages (POST)
router.post('/webhook', (req, res) => whatsAppController.receive(req, res));

export default router;