import type { Request, Response, NextFunction } from 'express';
import type { JWTPayload } from '@wfb/shared-types';

// The gateway injects X-User-Id, X-Tenant-Id, X-User-Role headers after JWT validation
// Internal services trust these headers (only gateway is exposed externally)
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}

export function gatewayAuth(req: Request, res: Response, next: NextFunction): void {
    const userId = req.headers['x-user-id'] as string | undefined;
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    const role = req.headers['x-user-role'] as string | undefined;

    if (!userId || !tenantId || !role) {
        res.status(401).json({ success: false, error: 'Unauthorized — missing gateway headers' });
        return;
    }

    req.user = {
        sub: userId,
        tid: tenantId,
        role: role as 'admin' | 'user',
        iat: 0,
        exp: 0,
    };
    next();
}

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ success: false, error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
