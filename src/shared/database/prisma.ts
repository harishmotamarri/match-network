import { PrismaClient } from '@prisma/client';
import logger from '../logger';

const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
    ],
});

if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
        logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'DB Query');
    });
}

prisma.$on('error', (e) => {
    logger.error({ message: e.message }, 'DB Error');
});

export default prisma;