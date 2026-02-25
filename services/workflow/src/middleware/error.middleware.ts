import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Unhandled error', { message: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Internal server error' });
}
