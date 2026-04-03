import 'dotenv/config';
import app from './app';
import { config } from './config';
import logger from './shared/logger';
import prisma from './shared/database/prisma';
import redis from './shared/cache/redis';
import cron from 'node-cron';
import { cleanupExpiredConnections } from './jobs/cleanup.job';
async function bootstrap() {
    try {
        // Test DB connection
        await prisma.$connect();
        logger.info('✅ Database connected');

        // Test Redis connection
        await redis.connect();
        logger.info('✅ Redis connected');

        app.listen(config.port, () => {
            logger.info(`🚀 Server running on http://localhost:${config.port}`);
            logger.info(`📋 Health check: http://localhost:${config.port}/health`);
        });
    } catch (err) {
        logger.error({ err }, 'Failed to start server');
        process.exit(1);
    }
    cron.schedule('0 2 * * *', async () => {
        logger.info('Running nightly cleanup...');
        await cleanupExpiredConnections();
    });
}

bootstrap();