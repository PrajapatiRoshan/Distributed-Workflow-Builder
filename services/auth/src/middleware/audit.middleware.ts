import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { logger } from '../logger';

export function auditLog(action: string) {
    return (_req: Request, _res: Response, next: NextFunction): void => {
        // Fire-and-forget audit log after request completes
        const origEnd = _res.end.bind(_res);
        (_res.end as typeof origEnd) = ((...args: Parameters<typeof origEnd>) => {
            void db
                .query(
                    `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, ip_address)
           VALUES ($1, $2, $3, 'auth', $4)`,
                    [
                        (_req as Request & { user?: { tid?: string } }).user?.tid ?? null,
                        (_req as Request & { user?: { sub?: string } }).user?.sub ?? null,
                        action,
                        _req.ip,
                    ],
                )
                .catch((e) => logger.error('Audit log failed', e));
            return origEnd(...args);
        }) as typeof origEnd;
        next();
    };
}
