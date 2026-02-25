import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { Client as MinioClient } from 'minio';
import { Pool } from 'pg';
import type { JWTPayload } from '@wfb/shared-types';

const PORT = parseInt(process.env['PORT'] ?? '3004', 10);

const db = new Pool({ connectionString: process.env['DATABASE_URL'] });
const minio = new MinioClient({
    endPoint: process.env['MINIO_ENDPOINT'] ?? 'localhost',
    port: parseInt(process.env['MINIO_PORT'] ?? '9000', 10),
    accessKey: process.env['MINIO_ACCESS_KEY'] ?? 'minioadmin',
    secretKey: process.env['MINIO_SECRET_KEY'] ?? 'minioadmin',
    useSSL: false,
});
const MINIO_BUCKET = process.env['MINIO_BUCKET'] ?? 'plugins';

const app = express();
app.use(helmet());
app.use(express.json());

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global { 
    namespace Express { 
        interface Request { 
            user?: JWTPayload; 
        } 
    } 
}

// Auth mock (real gateway injects headers)
app.use((req, res, next) => {
    if (req.headers['x-user-id']) {
        req.user = {
            sub: req.headers['x-user-id'] as string,
            tid: req.headers['x-tenant-id'] as string,
            role: req.headers['x-user-role'] as 'admin' | 'user',
            iat: 0, exp: 0,
        };
    }
    next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'plugin' }));

// ─── Marketplace / Registry ──────────────────────────────────

app.get('/', (req, res) => {
    void (async () => {
        const { rows } = await db.query(
            `SELECT id, name, slug, description, version, plugin_type, is_paid, price_cents, rating, reviews_count
     FROM plugins WHERE status = 'PUBLISHED'`
        );
        res.json({ success: true, data: { items: rows } });
    })();
});

app.get('/:slug', (req, res) => {
    void (async () => {
        const { rows } = await db.query(`SELECT * FROM plugins WHERE slug = $1 AND status = 'PUBLISHED'`, [req.params['slug']]);
        if (!rows[0]) {
            res.status(404).json({ success: false, error: 'Not found' });
            return;
        }
        const pluginData = rows[0] as Record<string, unknown>;
        res.json({ success: true, data: pluginData });
    })();
});

// ─── Upload (Admin/Author only) ──────────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

app.post('/', upload.single('artifact'), (req, res) => {
    void (async () => {
        if (!req.user || req.user.role !== 'admin') {
            res.status(403).json({ success: false, error: 'Unauthorized to publish plugins' });
            return;
        }

        try {
            const requestBody = req.body as Record<string, unknown>;
            const metadata = JSON.parse(requestBody['metadata'] as string) as {
                name: string;
                slug: string;
                description: string;
                version: string;
                plugin_type: string;
                schema: unknown;
                is_paid?: boolean;
                price_cents?: number;
            };
            // In production, robust Zod validation goes here
            const { name, slug, description, version, plugin_type, schema, is_paid, price_cents } = metadata;

            let artifact_url: string | null = null;

            if (req.file) {
                // Create bucket if missing
                const exists = await minio.bucketExists(MINIO_BUCKET).catch(() => false);
                if (!exists) await minio.makeBucket(MINIO_BUCKET, '');

                const objectName = `${slug}-${version}.zip`;
                await minio.putObject(MINIO_BUCKET, objectName, req.file.buffer, req.file.size, { 'Content-Type': 'application/zip' });
                artifact_url = `minio://${MINIO_BUCKET}/${objectName}`;
            }

            const { rows } = await db.query<{ id: string }>(
                `INSERT INTO plugins (tenant_id, author_id, name, slug, description, version, plugin_type, schema, artifact_url, is_paid, price_cents, status)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PUBLISHED') RETURNING id`,
                [req.user.sub, name, slug, description, version, plugin_type, JSON.stringify(schema), artifact_url, is_paid ?? false, price_cents ?? 0]
            );

            res.status(201).json({ success: true, data: { id: rows[0]!.id } });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            res.status(400).json({ success: false, error: errorMessage });
        }
    })();
});

// ─── Install/Buy Mock ────────────────────────────────────────

app.post('/:slug/install', (req, res) => {
    void (async () => {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const { rows } = await db.query(`SELECT * FROM plugins WHERE slug = $1`, [req.params['slug']]);
        if (!rows[0]) {
            res.status(404).json({ success: false, error: 'Not found' });
            return;
        }

        const plugin = rows[0] as { id: string; is_paid: boolean };
        if (plugin.is_paid) {
            // Mock Stripe payment
            await new Promise(r => setTimeout(r, 1000));
        }

        // Record install
        await db.query(
            `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id) VALUES ($1, $2, 'INSTALL_PLUGIN', 'plugin', $3)`,
            [req.user.tid, req.user.sub, plugin.id]
        );

        res.json({ success: true, message: 'Plugin installed successfully' });
    })();
});

app.listen(PORT, () => console.info(`Plugin Service running on port ${PORT}`));
