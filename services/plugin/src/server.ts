import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { Client as MinioClient } from 'minio';
import { Pool } from 'pg';

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

declare global { namespace Express { interface Request { user?: any; } } }

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'plugin' }));

// ─── Marketplace / Registry ──────────────────────────────────

app.get('/', async (req, res) => {
    const { rows } = await db.query(
        `SELECT id, name, slug, description, version, plugin_type, is_paid, price_cents, rating, reviews_count
     FROM plugins WHERE status = 'PUBLISHED'`
    );
    res.json({ success: true, data: { items: rows } });
});

app.get('/:slug', async (req, res) => {
    const { rows } = await db.query(`SELECT * FROM plugins WHERE slug = $1 AND status = 'PUBLISHED'`, [req.params['slug']]);
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: rows[0] });
});

// ─── Upload (Admin/Author only) ──────────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

app.post('/', upload.single('artifact'), async (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Unauthorized to publish plugins' });
    }

    try {
        const metadata = JSON.parse(req.body['metadata'] as string);
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

        const { rows } = await db.query(
            `INSERT INTO plugins (tenant_id, author_id, name, slug, description, version, plugin_type, schema, artifact_url, is_paid, price_cents, status)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PUBLISHED') RETURNING id`,
            [req.user.sub, name, slug, description, version, plugin_type, JSON.stringify(schema), artifact_url, is_paid ?? false, price_cents ?? 0]
        );

        res.status(201).json({ success: true, data: { id: rows[0].id } });
    } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ─── Install/Buy Mock ────────────────────────────────────────

app.post('/:slug/install', async (req, res) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(`SELECT * FROM plugins WHERE slug = $1`, [req.params['slug']]);
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Not found' });

    const plugin = rows[0];
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
});

app.listen(PORT, () => console.info(`Plugin Service running on port ${PORT}`));
