import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bullmq';
import { db } from '../db';
import { redis } from '../redis';
import { logger } from '../logger';
import { buildExecutionPlan } from '@wfb/dag-engine';
import type { StepJobPayload, WorkflowDefinition, RunStatus, DEFAULT_RETRY_POLICY } from '@wfb/shared-types';
import { DEFAULT_RETRY_POLICY as DRP } from '@wfb/shared-types';

export const runRouter = Router();

const stepQueue = new Queue<StepJobPayload>('workflow-steps', {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 1, // Retry handled inside worker
    },
});

const CreateRunSchema = z.object({
    workflowId: z.string().uuid(),
    input: z.record(z.unknown()).optional(),
});

// ─── Start a run ─────────────────────────────────────────────

runRouter.post('/', async (req, res, next) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
        const tenantId = req.user!.tid;
        const userId = req.user!.sub;

        const parsed = CreateRunSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
            return;
        }
        const { workflowId, input } = parsed.data;

        // Idempotency: if key exists, return existing run
        if (idempotencyKey) {
            const cached = await redis.get(`idem:run:${tenantId}:${idempotencyKey}`);
            if (cached) {
                res.json({ success: true, data: { runId: cached, idempotent: true } });
                return;
            }
        }

        // Concurrency limit: max 10 concurrent runs per tenant
        const concurrentKey = `concurrent:runs:${tenantId}`;
        const currentCount = await redis.incr(concurrentKey);
        await redis.expire(concurrentKey, 3600); // cleanup TTL
        if (currentCount > 10) {
            await redis.decr(concurrentKey);
            res.status(429).json({ success: false, error: 'Too many concurrent runs for this tenant' });
            return;
        }

        // Load the published workflow version
        const { rows: [workflow] } = await db.query<{
            current_version_id: string;
            is_published: boolean;
            definition: WorkflowDefinition;
        }>(
            `SELECT w.current_version_id, w.is_published, wv.definition
       FROM workflows w
       JOIN workflow_versions wv ON wv.id = w.current_version_id
       WHERE w.id = $1 AND w.tenant_id = $2`,
            [workflowId, tenantId],
        );

        if (!workflow) {
            await redis.decr(concurrentKey);
            res.status(404).json({ success: false, error: 'Workflow not found' });
            return;
        }
        if (!workflow.is_published) {
            await redis.decr(concurrentKey);
            res.status(400).json({ success: false, error: 'Workflow must be published before running' });
            return;
        }

        const runId = uuidv4();

        // Persist run record
        await db.query(
            `INSERT INTO workflow_runs (id, tenant_id, workflow_version_id, triggered_by, status, idempotency_key, input, started_at)
       VALUES ($1, $2, $3, $4, 'RUNNING', $5, $6, NOW())`,
            [runId, tenantId, workflow.current_version_id, userId, idempotencyKey, JSON.stringify(input ?? {})],
        );

        // Build execution plan from DAG
        const definition = workflow.definition as WorkflowDefinition;
        const plan = buildExecutionPlan(definition);
        const nodeMap = plan.nodeMap;

        // Pre-create all step records in PENDING state
        const stepIds = definition.nodes.map((n) => n.id);
        await db.query(
            `INSERT INTO run_steps (run_id, step_id, plugin_id, status)
       SELECT $1, unnest($2::text[]), NULL, 'PENDING'`,
            [runId, stepIds],
        );

        // Enqueue first wave (steps with no dependencies)
        const firstWave = plan.waves[0];
        if (firstWave) {
            const jobs = firstWave.steps.map((stepId) => {
                const node = nodeMap.get(stepId)!;
                const payload: StepJobPayload = {
                    runId,
                    stepId,
                    pluginId: node.pluginId,
                    pluginVersion: node.pluginVersion,
                    pluginType: node.type,
                    input: { ...(input ?? {}), ...node.config },
                    attempt: 1,
                    retryPolicy: node.retryPolicy ?? DRP,
                    idempotencyKey: `${runId}:${stepId}:1`,
                    tenantId,
                };
                return { name: `step:${stepId}`, data: payload };
            });

            await stepQueue.addBulk(jobs);
        }

        // Cache idempotency key
        if (idempotencyKey) {
            await redis.setex(`idem:run:${tenantId}:${idempotencyKey}`, 86400, runId);
        }

        // Publish WS event
        await redis.publish(`run:${runId}`, JSON.stringify({
            type: 'RUN_UPDATE', runId, status: 'RUNNING', ts: new Date().toISOString(),
        }));

        logger.info('Run started', { runId, workflowId, tenantId });
        res.status(201).json({ success: true, data: { runId } });
    } catch (err) { next(err); }
});

// ─── Get run status ──────────────────────────────────────────

runRouter.get('/:id', async (req, res, next) => {
    try {
        const { rows } = await db.query(
            `SELECT wr.*, json_agg(rs.* ORDER BY rs.step_id) AS steps
       FROM workflow_runs wr
       LEFT JOIN run_steps rs ON rs.run_id = wr.id
       WHERE wr.id = $1 AND wr.tenant_id = $2
       GROUP BY wr.id`,
            [req.params['id'], req.user!.tid],
        );
        if (!rows[0]) {
            res.status(404).json({ success: false, error: 'Run not found' });
            return;
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) { next(err); }
});

// ─── List runs ───────────────────────────────────────────────

runRouter.get('/', async (req, res, next) => {
    try {
        const tenantId = req.user!.tid;
        const limit = Math.min(parseInt(req.query['limit'] as string ?? '20', 10), 100);
        const { rows } = await db.query(
            `SELECT id, status, started_at, completed_at, created_at
       FROM workflow_runs WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT $2`,
            [tenantId, limit],
        );
        res.json({ success: true, data: { items: rows } });
    } catch (err) { next(err); }
});

// ─── Pause / Resume / Cancel ─────────────────────────────────

const StatusUpdateSchema = z.object({
    action: z.enum(['pause', 'resume', 'cancel']),
});

runRouter.patch('/:id/status', async (req, res, next) => {
    try {
        const parsed = StatusUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: 'action must be pause | resume | cancel' });
            return;
        }

        const { action } = parsed.data;
        const runId = req.params['id'];
        const tenantId = req.user!.tid;

        const { rows: [run] } = await db.query<{ status: RunStatus }>(
            `SELECT status FROM workflow_runs WHERE id = $1 AND tenant_id = $2`,
            [runId, tenantId],
        );
        if (!run) {
            res.status(404).json({ success: false, error: 'Run not found' });
            return;
        }

        let newStatus: RunStatus;
        if (action === 'pause') {
            if (run.status !== 'RUNNING') {
                res.status(409).json({ success: false, error: 'Can only pause a RUNNING run' });
                return;
            }
            newStatus = 'PAUSED';
            await redis.set(`run:${runId}:paused`, '1');
        } else if (action === 'resume') {
            if (run.status !== 'PAUSED') {
                res.status(409).json({ success: false, error: 'Can only resume a PAUSED run' });
                return;
            }
            newStatus = 'RUNNING';
            await redis.del(`run:${runId}:paused`);
        } else {
            if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
                res.status(409).json({ success: false, error: 'Run already in terminal state' });
                return;
            }
            newStatus = 'CANCELLED';
            await redis.set(`run:${runId}:cancelled`, '1');
        }

        await db.query(
            `UPDATE workflow_runs SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, runId],
        );

        await redis.publish(`run:${runId}`, JSON.stringify({
            type: 'RUN_UPDATE', runId, status: newStatus, ts: new Date().toISOString(),
        }));

        res.json({ success: true, data: { runId, status: newStatus } });
    } catch (err) { next(err); }
});

// ─── NDJSON log stream ───────────────────────────────────────

runRouter.get('/:id/logs/stream', async (req, res, next) => {
    try {
        const runId = req.params['id'];
        const tenantId = req.user!.tid;

        // Verify ownership
        const { rows: [run] } = await db.query(
            `SELECT id, status FROM workflow_runs WHERE id = $1 AND tenant_id = $2`,
            [runId, tenantId],
        );
        if (!run) {
            res.status(404).json({ success: false, error: 'Run not found' });
            return;
        }

        // Set NDJSON streaming headers
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering

        // Emit historical logs first
        const { rows: steps } = await db.query<{
            step_id: string;
            status: string;
            logs: Array<{ ts: string; level: string; message: string }>;
        }>(
            `SELECT step_id, status, logs FROM run_steps WHERE run_id = $1 ORDER BY started_at ASC`,
            [runId],
        );

        for (const step of steps) {
            for (const log of step.logs ?? []) {
                res.write(JSON.stringify({
                    runId, stepId: step.step_id, eventType: 'STEP_LOG',
                    log, ts: log.ts,
                }) + '\n');
            }
        }

        // If run is already terminal, close stream
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status as string)) {
            res.end();
            return;
        }

        // Subscribe to Redis Pub/Sub for live events
        const subscriber = redis.duplicate();
        await subscriber.subscribe(`run:${runId}`);

        subscriber.on('message', (_channel: string, message: string) => {
            if (!res.writableEnded) {
                res.write(message + '\n');
                try {
                    const parsed = JSON.parse(message) as { type?: string; status?: string };
                    if (parsed.type === 'RUN_UPDATE' && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(parsed.status ?? '')) {
                        void subscriber.unsubscribe();
                        void subscriber.quit();
                        res.end();
                    }
                } catch { /* ignore parse errors */ }
            }
        });

        req.on('close', () => {
            void subscriber.unsubscribe();
            void subscriber.quit();
        });
    } catch (err) { next(err); }
});
