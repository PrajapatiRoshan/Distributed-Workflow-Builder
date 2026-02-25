import 'dotenv/config';
import app from './app';
import { db } from './db';
import { redis } from './redis';
import { logger } from './logger';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

async function start() {
    try {
        await db.connect();
        logger.info('PostgreSQL connected');
        await redis.ping();
        logger.info('Redis connected');

        const server = app.listen(PORT, () => {
            logger.info(`Auth service running on port ${PORT}`);
        });

        const shutdown = async (signal: string) => {
            logger.info(`${signal} received — graceful shutdown`);
            server.close(async () => {
                await db.end();
                await redis.quit();
                process.exit(0);
            });
            setTimeout(() => process.exit(1), 10_000);
        };

        process.on('SIGTERM', () => void shutdown('SIGTERM'));
        process.on('SIGINT', () => void shutdown('SIGINT'));
    } catch (err) {
        logger.error('Failed to start auth service', err instanceof Error ? { message: err.message, stack: err.stack } : err);
        process.exit(1);
    }
}

void start();
