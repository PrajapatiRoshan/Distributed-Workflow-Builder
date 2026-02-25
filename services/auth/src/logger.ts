export const logger = {
    info: (msg: string, meta?: unknown) => console.info(JSON.stringify({ level: 'info', msg, meta, ts: new Date().toISOString() })),
    warn: (msg: string, meta?: unknown) => console.warn(JSON.stringify({ level: 'warn', msg, meta, ts: new Date().toISOString() })),
    error: (msg: string, meta?: unknown) => console.error(JSON.stringify({ level: 'error', msg, meta, ts: new Date().toISOString() })),
    debug: (msg: string, meta?: unknown) => {
        if (process.env['NODE_ENV'] !== 'production') {
            console.info(JSON.stringify({ level: 'debug', msg, meta, ts: new Date().toISOString() }));
        }
    },
};
