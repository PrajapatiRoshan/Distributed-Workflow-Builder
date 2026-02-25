import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { authRouter } from './routes/auth.routes';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request-logger.middleware';

const app = express();

// ─── Security Middleware ──────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(requestLogger);

// Rate limit: 20 auth requests per minute
app.use(
    rateLimit({
        windowMs: 60_000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Too many requests' },
    }),
);

// ─── Routes ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'auth', ts: new Date().toISOString() });
});
app.use('/auth', authRouter);

// ─── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

export default app;
