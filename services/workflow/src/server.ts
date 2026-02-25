import 'dotenv/config';
import app from './app';
import { db } from './db';
import { logger } from './logger';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);

async function start() {
    await db.connect();
    logger.info('PostgreSQL connected');
    const server = app.listen(PORT, () => logger.info(`Workflow service on port ${PORT}`));

    const shutdown = async (signal: string) => {
        logger.info(`${signal} — shutdown`);
        server.close(async () => { await db.end(); process.exit(0); });
        setTimeout(() => process.exit(1), 10_000);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}
void start();
