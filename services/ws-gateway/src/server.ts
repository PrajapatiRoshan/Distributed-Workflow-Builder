import 'dotenv/config';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { createServer } from 'http';

const PORT = parseInt(process.env['PORT'] ?? '3005', 10);
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', service: 'ws-gateway' }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

const io = new Server(httpServer, {
    path: '/ws',
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket'],
});

const subscriber = new Redis(REDIS_URL);

// ─── Authentication middleware ───────────────────────────────

io.use((socket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined;
    if (!token) return next(new Error('Authentication error'));
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; tid: string };
        socket.data = { userId: decoded.sub, tenantId: decoded.tid };
        next();
    } catch {
        next(new Error('Authentication error'));
    }
});

// ─── Connection handler ──────────────────────────────────────

io.on('connection', (socket) => {
    const { userId, tenantId } = socket.data as { userId: string; tenantId: string };
    console.info(`Client connected: ${userId} (${tenantId})`);

    socket.on('subscribe:run', (runId: string) => {
        // Basic auth check: we would normally verify ownership here via DB,
        // but trusting the JWT tenant scope + client knowing the runId for this demo
        const room = `run:${runId}`;
        void socket.join(room);
        console.info(`Socket ${socket.id} joined ${room}`);
    });

    socket.on('unsubscribe:run', (runId: string) => {
        const room = `run:${runId}`;
        void socket.leave(room);
    });

    socket.on('disconnect', () => {
        console.info(`Client disconnected: ${userId}`);
    });
});

// ─── Redis Pub/Sub listener ──────────────────────────────────
// Fan-out run events from Redis directly to connected UI clients

void subscriber.psubscribe('run:*', (err, count) => {
    if (err) console.error('Redis psubscribe error', err);
    else console.info(`Subscribed to ${String(count)} Redis channels`);
});

subscriber.on('pmessage', (_pattern, channel, message) => {
    // channel = run:{runId}
    // message = JSON string
    io.to(channel).emit('event', message);
});

httpServer.listen(PORT, () => {
    console.info(`WebSocket Gateway running on port ${PORT}`);
});
