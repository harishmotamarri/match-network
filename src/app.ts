import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import logger from './shared/logger';

// Routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import skillRoutes from './modules/skills/skills.routes';
import connectionsRoutes from './modules/connections/connections.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
const app = express();
app.set('trust proxy', 1);
// Security middleware
app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter: 100 requests per minute per IP
app.use(
    rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        message: { success: false, message: 'Too many requests' },
    })
);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/v1/auth', authRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/skills', skillRoutes);
app.use('/v1/connections', connectionsRoutes);
app.use('/v1/whatsapp', whatsappRoutes);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ success: false, message: 'Internal server error' });
});

export default app;