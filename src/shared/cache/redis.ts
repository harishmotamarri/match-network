import { Redis } from 'ioredis';
import logger from '../logger';

const redisUrl = process.env.REDIS_URL!;

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    tls: { rejectUnauthorized: false },
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));

export default redis;