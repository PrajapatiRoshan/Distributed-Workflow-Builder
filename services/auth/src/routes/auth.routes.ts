import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { issueTokenPair, rotateRefreshToken, revokeAllUserTokens, hashPassword, verifyPassword } from '../services/jwt.service';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/audit.middleware';
import type { UserRole } from '@wfb/shared-types';

export const authRouter = Router();

const REFRESH_COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/auth/refresh',
};

// ─── Register ────────────────────────────────────────────────

const RegisterSchema = z.object({
    email: z.string().email().max(320),
    password: z.string().min(8).max(128).regex(/^(?=.*[A-Z])(?=.*\d)/, {
        message: 'Password must contain at least one uppercase letter and one digit',
    }),
    tenantName: z.string().min(2).max(255).optional(),
});

authRouter.post('/register', validate(RegisterSchema), auditLog('REGISTER'), (req, res, next) => {
    void (async () => {
        try {
            const { email, password, tenantName } = req.body as z.infer<typeof RegisterSchema>;

        // Create or use existing tenant
        let tenantId: string;
        if (tenantName) {
            const { rows } = await db.query<{ id: string }>(
                `INSERT INTO tenants (name) VALUES ($1) RETURNING id`,
                [tenantName],
            );
            tenantId = rows[0]!.id;
        } else {
            tenantId = '00000000-0000-0000-0000-000000000001'; // default tenant
        }

        // Check duplicate
        const { rows: existing } = await db.query(
            `SELECT id FROM users WHERE tenant_id = $1 AND email = $2`,
            [tenantId, email.toLowerCase()],
        );
        if (existing.length > 0) {
            res.status(409).json({ success: false, error: 'Email already registered' });
            return;
        }

        const pwHash = await hashPassword(password);
        const { rows } = await db.query<{ id: string; role: UserRole }>(
            `INSERT INTO users (tenant_id, email, pw_hash, role) VALUES ($1, $2, $3, 'user') RETURNING id, role`,
            [tenantId, email.toLowerCase(), pwHash],
        );
        const user = rows[0]!;

        const tokens = await issueTokenPair(user.id, tenantId, user.role);
        res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTS);
        res.status(201).json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                expiresIn: tokens.expiresIn,
                userId: user.id,
                tenantId,
                role: user.role,
            },
        });
        } catch (err) {
            next(err);
        }
    })();
});

// ─── Login ───────────────────────────────────────────────────

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

authRouter.post('/login', validate(LoginSchema), auditLog('LOGIN'), (req, res, next) => {
    void (async () => {
        try {
            const { email, password } = req.body as z.infer<typeof LoginSchema>;

        const { rows } = await db.query<{
            id: string;
            tenant_id: string;
            pw_hash: string;
            role: UserRole;
            is_active: boolean;
        }>(
            `SELECT id, tenant_id, pw_hash, role, is_active FROM users WHERE email = $1 LIMIT 1`,
            [email.toLowerCase()],
        );
        const user = rows[0];

        const valid = user ? await verifyPassword(password, user.pw_hash) : false;
        if (!user || !valid || !user.is_active) {
            // Constant-time: always hash even if user not found (prevent timing attacks)
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }

        const tokens = await issueTokenPair(user.id, user.tenant_id, user.role);
        res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTS);
        res.json({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                expiresIn: tokens.expiresIn,
                userId: user.id,
                tenantId: user.tenant_id,
                role: user.role,
            },
        });
        } catch (err) {
            next(err);
        }
    })();
});

// ─── Refresh ─────────────────────────────────────────────────

authRouter.post('/refresh', (req, res, next) => {
    void (async () => {
        try {
            const rawToken = req.cookies?.['refreshToken'] as string | undefined;
        if (!rawToken) {
            res.status(401).json({ success: false, error: 'No refresh token' });
            return;
        }

        const result = await rotateRefreshToken(rawToken);
        if (!result) {
            res.clearCookie('refreshToken');
            res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
            return;
        }

        const tokens = await issueTokenPair(result.userId, result.tenantId, result.role);
        res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTS);
        res.json({
            success: true,
            data: { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn },
        });
        } catch (err) {
            next(err);
        }
    })();
});

// ─── Logout ──────────────────────────────────────────────────

authRouter.post('/logout', requireAuth, (req, res, next) => {
    void (async () => {
        try {
            const userId = req.user!.sub;
            await revokeAllUserTokens(userId);
            res.clearCookie('refreshToken');
            res.json({ success: true, message: 'Logged out successfully' });
        } catch (err) {
            next(err);
        }
    })();
});

// ─── Me (current user info) ──────────────────────────────────

authRouter.get('/me', requireAuth, (req, res, next) => {
    void (async () => {
        try {
            const { rows } = await db.query(
                `SELECT id, tenant_id, email, role, is_active, created_at FROM users WHERE id = $1`,
                [req.user!.sub],
            );
            if (!rows[0]) {
                res.status(404).json({ success: false, error: 'User not found' });
                return;
            }
            const userData = rows[0] as Record<string, unknown>;
            res.json({ success: true, data: userData });
        } catch (err) {
            next(err);
        }
    })();
});
