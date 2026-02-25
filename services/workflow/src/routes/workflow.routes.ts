import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireRole } from '../middleware/gateway-auth.middleware';
import { validateWorkflowDefinition } from '@wfb/dag-engine';
import { detectCycles, buildExecutionPlan } from '@wfb/dag-engine';
import type { WorkflowDefinition } from '@wfb/shared-types';

export const workflowRouter = Router();

// ─── Zod Schemas ─────────────────────────────────────────────

const NodeSchema = z.object({
    id: z.string().min(1),
    type: z.enum(['TEXT_TRANSFORM', 'API_PROXY', 'DATA_AGGREGATOR', 'DELAY', 'CUSTOM']),
    pluginId: z.string().min(1),
    pluginVersion: z.string(),
    label: z.string(),
    config: z.record(z.unknown()),
    position: z.object({ x: z.number(), y: z.number() }),
    retryPolicy: z.object({
        maxAttempts: z.number().int().min(1).max(10),
        initialDelayMs: z.number().min(100),
        backoffMultiplier: z.number().min(1),
        maxDelayMs: z.number().max(300_000),
    }).optional(),
});

const EdgeSchema = z.object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    condition: z.enum(['true', 'false']).optional(),
    conditionExpression: z.string().max(500).optional(),
});

const WorkflowDefinitionSchema = z.object({
    nodes: z.array(NodeSchema).min(1).max(100),
    edges: z.array(EdgeSchema).max(500),
    globalInput: z.record(z.unknown()).optional(),
});

const CreateWorkflowSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    definition: WorkflowDefinitionSchema,
});

// ─── Routes ──────────────────────────────────────────────────

// Validate a definition without saving (dry-run) - MUST be before /:id routes
workflowRouter.post('/validate', (req, res, next) => {
    try {
        const parsed = WorkflowDefinitionSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: 'Schema error', details: parsed.error.flatten() });
            return;
        }
        const def = parsed.data as WorkflowDefinition;
        const structural = validateWorkflowDefinition(def);
        const cycle = detectCycles(def);
        let plan = null;
        if (structural.valid && !cycle.hasCycle) {
            plan = buildExecutionPlan(def);
        }
        res.json({
            success: true,
            data: {
                valid: structural.valid && !cycle.hasCycle,
                errors: structural.errors,
                warnings: [],
                hasCycle: cycle.hasCycle,
                executionWaves: plan?.waves ?? null,
            },
        });
    } catch (err) { next(err); }
});

// LIST workflows (tenant-scoped, cursor paginated)
workflowRouter.get('/', (req, res, next) => {
    void (async () => {
        try {
            const tenantId = req.user!.tid;
            const cursor = req.query['cursor'] as string | undefined;
            const limit = Math.min(parseInt(req.query['limit'] as string ?? '20', 10), 100);

            const { rows } = await db.query<{
                id: string; name: string; description: string; is_published: boolean;
                current_version_id: string; created_at: Date; updated_at: Date;
            }>(
                `SELECT id, name, description, is_published, current_version_id, created_at, updated_at
       FROM workflows
       WHERE tenant_id = $1 ${cursor ? 'AND created_at < $3' : ''}
       ORDER BY created_at DESC
       LIMIT $2`,
                cursor ? [tenantId, limit, new Date(cursor)] : [tenantId, limit],
            );

            res.json({
                success: true,
                data: {
                    items: rows,
                    hasNext: rows.length === limit,
                    cursor: rows[rows.length - 1]?.created_at?.toISOString(),
                },
            });
        } catch (err) { next(err); }
    })();
});

// CREATE workflow
workflowRouter.post('/', (req, res, next) => {
    void (async () => {
        try {
            const parsed = CreateWorkflowSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
                return;
            }
            const { name, description, definition } = parsed.data;
            const tenantId = req.user!.tid;
            const ownerId = req.user!.sub;

            // Validate DAG structure
            const structuralErrors = validateWorkflowDefinition(definition as WorkflowDefinition);
            if (!structuralErrors.valid) {
                res.status(400).json({ success: false, error: 'Invalid DAG', details: structuralErrors.errors });
                return;
            }
            const cycleResult = detectCycles(definition as WorkflowDefinition);
            if (cycleResult.hasCycle) {
                res.status(400).json({ success: false, error: `Cycle detected: ${cycleResult.cycle?.join(' → ')}` });
                return;
            }

            const client = await db.connect();
            try {
                await client.query('BEGIN');

                // Create workflow
                const { rows: [wf] } = await client.query<{ id: string }>(
                    `INSERT INTO workflows (tenant_id, owner_id, name, description)
         VALUES ($1, $2, $3, $4) RETURNING id`,
                    [tenantId, ownerId, name, description],
                );

                // Create initial version (v1)
                const { rows: [version] } = await client.query<{ id: string }>(
                    `INSERT INTO workflow_versions (workflow_id, version, definition, created_by)
         VALUES ($1, 1, $2, $3) RETURNING id`,
                    [wf!.id, JSON.stringify(definition), ownerId],
                );

                // Set current version
                await client.query(
                    `UPDATE workflows SET current_version_id = $1 WHERE id = $2`,
                    [version!.id, wf!.id],
                );

                await client.query('COMMIT');
                res.status(201).json({ success: true, data: { id: wf!.id, versionId: version!.id } });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } catch (err) { next(err); }
    })();
});

// GET single workflow
workflowRouter.get('/:id', (req, res, next) => {
    void (async () => {
        try {
            const { rows } = await db.query(
                `SELECT w.*, wv.definition, wv.version, wv.changelog
       FROM workflows w
       LEFT JOIN workflow_versions wv ON wv.id = w.current_version_id
       WHERE w.id = $1 AND w.tenant_id = $2`,
                [req.params['id'], req.user!.tid],
            );
            if (!rows[0]) {
                res.status(404).json({ success: false, error: 'Workflow not found' });
                return;
            }
            const workflowData = rows[0] as Record<string, unknown>;
            res.json({ success: true, data: workflowData });
        } catch (err) { next(err); }
    })();
});

// UPDATE workflow (creates new version)
workflowRouter.put('/:id', (req, res, next) => {
    void (async () => {
        try {
            const parsed = CreateWorkflowSchema.partial().safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
                return;
            }

            const workflowId = req.params['id'];
            const tenantId = req.user!.tid;

            // Verify ownership
            const { rows: [existing] } = await db.query<{ id: string; owner_id: string }>(
                `SELECT id, owner_id FROM workflows WHERE id = $1 AND tenant_id = $2`,
                [workflowId, tenantId],
            );
            if (!existing) {
                res.status(404).json({ success: false, error: 'Workflow not found' });
                return;
            }
            if (existing.owner_id !== req.user!.sub && req.user!.role !== 'admin') {
                res.status(403).json({ success: false, error: 'Not your workflow' });
                return;
            }

            const { definition } = parsed.data;
            if (definition) {
                // Validate new definition
                const structuralErrors = validateWorkflowDefinition(definition as WorkflowDefinition);
                if (!structuralErrors.valid) {
                    res.status(400).json({ success: false, error: 'Invalid DAG', details: structuralErrors.errors });
                    return;
                }
                const cycleResult = detectCycles(definition as WorkflowDefinition);
                if (cycleResult.hasCycle) {
                    res.status(400).json({ success: false, error: `Cycle detected: ${cycleResult.cycle?.join(' → ')}` });
                    return;
                }
            }

            const client = await db.connect();
            try {
                await client.query('BEGIN');

                // Get next version number
                const versionResult = await client.query<{ maxVer: number }>(
                    `SELECT COALESCE(MAX(version), 0) AS "maxVer" FROM workflow_versions WHERE workflow_id = $1`,
                    [workflowId],
                );
                const maxVer = versionResult.rows[0]?.maxVer ?? 0;

                const updates: string[] = [];
                const values: unknown[] = [workflowId];

                if (parsed.data.name) {
                    values.push(parsed.data.name);
                    updates.push(`name = $${values.length}`);
                }
                if (parsed.data.description !== undefined) {
                    values.push(parsed.data.description);
                    updates.push(`description = $${values.length}`);
                }

                if (updates.length > 0) {
                    await client.query(`UPDATE workflows SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`, values);
                }

                let newVersionId: string | undefined;
                if (definition) {
                    const { rows: [ver] } = await client.query<{ id: string }>(
                        `INSERT INTO workflow_versions (workflow_id, version, definition, created_by)
           VALUES ($1, $2, $3, $4) RETURNING id`,
                        [workflowId, maxVer + 1, JSON.stringify(definition), req.user!.sub],
                    );
                    newVersionId = ver!.id;
                    await client.query(`UPDATE workflows SET current_version_id = $1, updated_at = NOW() WHERE id = $2`, [newVersionId, workflowId]);
                }

                await client.query('COMMIT');
                res.json({ success: true, data: { workflowId, versionId: newVersionId } });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } catch (err) { next(err); }
    })();
});

// DELETE workflow — admin or owner only
workflowRouter.delete('/:id', (req, res, next) => {
    void (async () => {
        try {
            const { rows: [existing] } = await db.query<{ owner_id: string }>(
                `SELECT owner_id FROM workflows WHERE id = $1 AND tenant_id = $2`,
                [req.params['id'], req.user!.tid],
            );
            if (!existing) {
                res.status(404).json({ success: false, error: 'Workflow not found' });
                return;
            }
            if (existing.owner_id !== req.user!.sub && req.user!.role !== 'admin') {
                res.status(403).json({ success: false, error: 'Not authorized' });
                return;
            }
            await db.query(`DELETE FROM workflows WHERE id = $1`, [req.params['id']]);
            res.json({ success: true, message: 'Workflow deleted' });
        } catch (err) { next(err); }
    })();
});

// LIST versions
workflowRouter.get('/:id/versions', (req, res, next) => {
    void (async () => {
        try {
            const { rows } = await db.query(
                `SELECT id, version, changelog, created_by, created_at
       FROM workflow_versions wv
       JOIN workflows w ON w.id = wv.workflow_id
       WHERE wv.workflow_id = $1 AND w.tenant_id = $2
       ORDER BY version DESC`,
                [req.params['id'], req.user!.tid],
            );
            res.json({ success: true, data: { items: rows } });
        } catch (err) { next(err); }
    })();
});

// GET specific version (for diff comparison)
workflowRouter.get('/:id/versions/:versionId', (req, res, next) => {
    void (async () => {
        try {
            const { rows } = await db.query(
                `SELECT wv.* FROM workflow_versions wv
       JOIN workflows w ON w.id = wv.workflow_id
       WHERE wv.id = $1 AND wv.workflow_id = $2 AND w.tenant_id = $3`,
                [req.params['versionId'], req.params['id'], req.user!.tid],
            );
            if (!rows[0]) {
                res.status(404).json({ success: false, error: 'Version not found' });
                return;
            }
            const versionData = rows[0] as Record<string, unknown>;
            res.json({ success: true, data: versionData });
        } catch (err) { next(err); }
    })();
});

// PUBLISH workflow (locks current definition as the run-able version)
workflowRouter.post('/:id/publish', requireRole('admin', 'user'), (req, res, next) => {
    void (async () => {
        try {
            await db.query(
                `UPDATE workflows SET is_published = TRUE, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
                [req.params['id'], req.user!.tid],
            );
            res.json({ success: true, message: 'Workflow published' });
        } catch (err) { next(err); }
    })();
});

// Validate endpoint moved to top of file before /:id routes
