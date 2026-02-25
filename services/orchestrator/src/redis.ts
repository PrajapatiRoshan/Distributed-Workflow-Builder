import Redis from 'ioredis';
import { logger } from './db';

export const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    retryStrategy: (times) => Math.min(times * 100, 3000),
    maxRetriesPerRequest: 3,
});
redis.on('error', (err) => logger.error('Redis error', err));

export { logger };
