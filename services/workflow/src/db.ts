// Shared infrastructure files for workflow service (db, logger, error middleware)
// Copy pattern from auth service — reuse same implementations
import { Pool } from 'pg';

export const logger = {
    info: (msg: string, meta?: unknown) => console.info(JSON.stringify({ level: 'info', msg, meta, ts: new Date().toISOString() })),
    warn: (msg: string, meta?: unknown) => console.warn(JSON.stringify({ level: 'warn', msg, meta, ts: new Date().toISOString() })),
    error: (msg: string, meta?: unknown) => console.error(JSON.stringify({ level: 'error', msg, meta, ts: new Date().toISOString() })),
};

export const db = new Pool({
    connectionString: process.env['DATABASE_URL'],
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});
db.on('error', (err) => logger.error('DB pool error', err));
