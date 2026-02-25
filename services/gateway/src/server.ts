import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { rateLimit } from 'express-rate-limit';
import RedisStore, { type SendCommandFn } from 'rate-limit-redis';
import { createProxyMiddleware } from 'http-proxy-middleware';

// ─── Config ──────────────────────────────────────────────────

const PORT = parseInt(process.env['PORT'] ?? '8000', 10);
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret'; // Or public key in asymmetric setup
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

const services = {
    auth: process.env['AUTH_SERVICE_URL'] ?? 'http://localhost:3001',
    workflow: process.env['WORKFLOW_SERVICE_URL'] ?? 'http://localhost:3002',
    orchestrator: process.env['ORCHESTRATOR_SERVICE_URL'] ?? 'http://localhost:3003',
    plugin: process.env['PLUGIN_SERVICE_URL'] ?? 'http://localhost:3004',
    ws: process.env['WS_GATEWAY_URL'] ?? 'http://localhost:3005',
};

// ─── Setup ───────────────────────────────────────────────────

const app = express();
const redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

app.use(helmet());

// Global Rate Limiter: 500 req/min per IP (increased for development)
app.use(
    rateLimit({
        windowMs: 60_000,
        max: 500,
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({
            prefix: 'rl:ip:',
            sendCommand: (async (...args: string[]) => {
                const [command, ...rest] = args;
                if (!command) throw new Error('No command provided');
                return redisClient.call(command, ...rest);
            }) as SendCommandFn
        }),
        message: { success: false, error: 'Too many requests' },
    }),
);

// ─── Auth Middleware ─────────────────────────────────────────

// Verifies JWT and injects headers; does NOT block if missing (services handle RBAC)
function injectAuth(req: Request, _res: Response, next: NextFunction): void {
    req.headers['x-request-id'] = uuidv4(); // tracing

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next();
    }

    try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; tid: string; role: string };
        req.headers['x-user-id'] = decoded.sub;
        req.headers['x-tenant-id'] = decoded.tid;
        req.headers['x-user-role'] = decoded.role;
    } catch {
        // Invalid token — let the downstream service reject it
    }
    next();
}

app.use(injectAuth);

// ─── Routes ──────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));

// Auth Service (no auth injection needed for login/register)
app.use('/auth', createProxyMiddleware({ target: services.auth, changeOrigin: true }));

// Workflow Service
app.use('/workflows', createProxyMiddleware({ target: services.workflow, changeOrigin: true }));

// Orchestrator Service
app.use('/runs', createProxyMiddleware({ target: services.orchestrator, changeOrigin: true }));

// Plugin Service
app.use('/plugins', createProxyMiddleware({ target: services.plugin, changeOrigin: true }));

// WebSocket Upgrade route
app.use('/ws', createProxyMiddleware({ target: services.ws, ws: true, changeOrigin: true }));

// ─── Server ──────────────────────────────────────────────────

app.listen(PORT, () => console.info(`API Gateway listening on port ${PORT}`));
