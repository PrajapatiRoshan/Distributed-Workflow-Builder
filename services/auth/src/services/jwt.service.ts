import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { redis } from '../redis';
import { db } from '../db';
import { logger } from '../logger';
import type { JWTPayload, UserRole, AuthTokens } from '@wfb/shared-types';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret';
const JWT_ACCESS_EXPIRES = process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m';
const JWT_REFRESH_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── JWT ─────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// ─── Refresh Tokens ─────────────────────────────────────────

export async function issueRefreshToken(userId: string): Promise<string> {
    const rawToken = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRES_SECONDS * 1000);

    // Store hashed token in DB
    await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt],
    );

    // Mark in Redis for fast-path validation (TTL = refresh expiry)
    await redis.setex(`rt:${tokenHash}`, JWT_REFRESH_EXPIRES_SECONDS, userId);

    return rawToken;
}

export async function rotateRefreshToken(
    rawToken: string,
): Promise<{ userId: string; tenantId: string; role: UserRole } | null> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Fast-path: check Redis
    const userId = await redis.get(`rt:${tokenHash}`);
    if (!userId) return null;

    // Validate against DB and check not revoked
    const { rows } = await db.query<{
        user_id: string;
        expires_at: Date;
        revoked: boolean;
        tenant_id: string;
        role: UserRole;
    }>(
        `SELECT rt.user_id, rt.expires_at, rt.revoked, u.tenant_id, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
        [tokenHash],
    );

    const record = rows[0];
    if (!record || record.revoked || record.expires_at < new Date()) {
        await redis.del(`rt:${tokenHash}`);
        return null;
    }

    // Revoke old token (rotation)
    await db.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
    await redis.del(`rt:${tokenHash}`);

    return { userId: record.user_id, tenantId: record.tenant_id, role: record.role };
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
    const { rows } = await db.query<{ token_hash: string }>(
        `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE RETURNING token_hash`,
        [userId],
    );
    const pipeline = redis.pipeline();
    for (const row of rows) {
        pipeline.del(`rt:${row.token_hash}`);
    }
    await pipeline.exec();
}

// ─── Password ────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
    const rounds = parseInt(process.env['BCRYPT_ROUNDS'] ?? '12', 10);
    return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// ─── Full auth token pair ────────────────────────────────────

export async function issueTokenPair(
    userId: string,
    tenantId: string,
    role: UserRole,
): Promise<AuthTokens> {
    const accessToken = signAccessToken({ sub: userId, tid: tenantId, role });
    const refreshToken = await issueRefreshToken(userId);
    logger.info('Issued token pair', { userId, tenantId, role });
    return { accessToken, refreshToken, expiresIn: 900 }; // 15 min in seconds
}
