import { Queue, Worker, Job } from 'bullmq';
import redis from '../../shared/cache/redis';
import { matchingService, MatchRequest } from './matching.service';
import logger from '../../shared/logger';

// Queue definition
export const matchingQueue = new Queue('matching', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
    },
});

// Worker — processes jobs from the queue
export const matchingWorker = new Worker(
    'matching',
    async (job: Job<MatchRequest>) => {
        logger.info({ jobId: job.id, requesterId: job.data.requesterId }, 'Processing match job');

        const results = await matchingService.findMatches(job.data);

        logger.info(
            { jobId: job.id, matchesFound: results.length },
            'Match job complete'
        );

        return results;
    },
    {
        connection: redis,
        concurrency: 5, // process 5 jobs simultaneously
    }
);

matchingWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, '✅ Match job completed');
});

matchingWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '❌ Match job failed');
});