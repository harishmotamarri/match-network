import 'dotenv/config';
import app from './app';
import { config } from './config';
import logger from './shared/logger';
import prisma from './shared/database/prisma';
import redis from './shared/cache/redis';
import cron from 'node-cron';
import { cleanupExpiredConnections } from './jobs/cleanup.job';
import { execSync } from 'node:child_process';

function getDatabaseTarget() {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) return null;

    try {
        const parsed = new URL(rawUrl);
        const dbName = parsed.pathname?.replace(/^\//, '') || 'unknown';
        const schema = parsed.searchParams.get('schema') || 'public';
        return {
            host: parsed.hostname,
            port: parsed.port || '5432',
            database: dbName,
            schema,
        };
    } catch {
        return null;
    }
}

function shouldRunMigrationsOnStartup(): boolean {
    const envValue = process.env.RUN_DB_MIGRATIONS_ON_STARTUP;
    if (envValue === 'false' || envValue === '0') return false;
    if (envValue === 'true' || envValue === '1') return true;
    return process.env.NODE_ENV === 'production';
}

function runMigrationsAtStartup() {
    if (!shouldRunMigrationsOnStartup()) return;

    logger.info('Running Prisma migrations at startup...');
    execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        cwd: process.cwd(),
    });
    logger.info('Prisma migrations completed');
}

async function bootstrap() {
    try {
        const dbTarget = getDatabaseTarget();
        if (dbTarget) {
            logger.info({ dbTarget }, 'Database target resolved from DATABASE_URL');
        } else {
            logger.warn('Could not parse DATABASE_URL for diagnostics');
        }

        runMigrationsAtStartup();

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