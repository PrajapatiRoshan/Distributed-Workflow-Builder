import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/jwt.service';
import type { JWTPayload } from '@wfb/shared-types';

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
        return;
    }
    try {
        const token = header.slice(7);
        req.user = verifyAccessToken(token);
        next();
    } catch {
        res.status(401).json({ success: false, error: 'Token expired or invalid' });
    }
}

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ success: false, error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
