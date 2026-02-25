import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import { Pool } from 'pg';
import Redis from 'ioredis';
import Docker from 'dockerode';
import { getNextReadySteps, calculateRetryDelay } from '@wfb/dag-engine';
import type { StepJobPayload, WorkflowDefinition, StepLog } from '@wfb/shared-types';
import { runPluginInProcess } from './plugins/plugin-runner';

// ─── Infrastructure ──────────────────────────────────────────

const logger = {
    info: (msg: string, meta?: unknown) => console.info(JSON.stringify({ level: 'info', msg, meta, ts: new Date().toISOString() })),
    warn: (msg: string, meta?: unknown) => console.warn(JSON.stringify({ level: 'warn', msg, meta, ts: new Date().toISOString() })),
    error: (msg: string, meta?: unknown) => console.error(JSON.stringify({ level: 'error', msg, meta, ts: new Date().toISOString() })),
};

const redisConn = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    retryStrategy: (t) => Math.min(t * 100, 3000),
    maxRetriesPerRequest: null, // required for BullMQ
});

const db = new Pool({
    connectionString: process.env['DATABASE_URL'],
    max: 20,
    idleTimeoutMillis: 30_000,
});
db.on('error', (err) => logger.error('DB pool error', err));

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const stepQueue = new Queue<StepJobPayload>('workflow-steps', { connection: redisConn });

const CONCURRENCY = parseInt(process.env['WORKER_CONCURRENCY'] ?? '10', 10);
const SANDBOX_TIMEOUT_MS = parseInt(process.env['SANDBOX_TIMEOUT_MS'] ?? '30000', 10);

// ─── Worker ──────────────────────────────────────────────────

const worker = new Worker<StepJobPayload>(
    'workflow-steps',
    async (job) => {
        const payload = job.data;
        const { runId, stepId, tenantId } = payload;

        try {
            // ── Pre-flight checks ──
            const isCancelled = await redisConn.get(`run:${runId}:cancelled`);
            if (isCancelled) {
                logger.info('Step skipped — run cancelled', { runId, stepId });
                await markStepStatus(runId, stepId, 'SKIPPED', payload.attempt);
                return;
            }

            // Pause: poll until unpaused (max 10min wait)
            let pauseWait = 0;
            while (await redisConn.get(`run:${runId}:paused`)) {
                if (pauseWait > 600_000) throw new Error('Paused too long — step timed out');
                await sleep(2000);
                pauseWait += 2000;
            }

            // Idempotency: skip if step already completed
            const alreadyDone = await redisConn.get(`step:${runId}:${stepId}:done`);
            if (alreadyDone) {
                logger.info('Step already completed — skipping (idempotent)', { runId, stepId });
                return JSON.parse(alreadyDone) as Record<string, unknown>;
            }

            // ── Mark step as RUNNING ──
            await db.query(
                `UPDATE run_steps SET status = 'RUNNING', started_at = NOW(), attempt = $1 WHERE run_id = $2 AND step_id = $3`,
                [payload.attempt, runId, stepId],
            );
            await publishEvent(runId, stepId, 'STEP_STARTED', 'RUNNING');

            const stepLogs: StepLog[] = [];
            const addLog = (level: StepLog['level'], message: string, meta?: Record<string, unknown>) => {
                const entry: StepLog = { ts: new Date().toISOString(), level, message, ...(meta && { meta }) };
                stepLogs.push(entry);
                void publishLogEvent(runId, stepId, entry);
            };

            addLog('info', `Starting step ${stepId} (attempt ${payload.attempt})`);

            // ── Execute plugin ──
            let output: Record<string, unknown>;
            try {
                output = await runPluginInProcess(payload, docker, SANDBOX_TIMEOUT_MS, addLog);
            } catch (pluginErr) {
                const errMsg = pluginErr instanceof Error ? pluginErr.message : String(pluginErr);
                addLog('error', `Plugin execution failed: ${errMsg}`);
                throw pluginErr;
            }

            // ── Mark step COMPLETED ──
            const durationMs = Date.now() - (new Date().getTime() - stepLogs.length * 10);
            await db.query(
                `UPDATE run_steps SET status = 'COMPLETED', output = $1, logs = $2, completed_at = NOW(), duration_ms = $3
         WHERE run_id = $4 AND step_id = $5`,
                [JSON.stringify(output), JSON.stringify(stepLogs), durationMs, runId, stepId],
            );

            // Cache completion for idempotency (24h)
            await redisConn.setex(`step:${runId}:${stepId}:done`, 86400, JSON.stringify(output));
            await publishEvent(runId, stepId, 'STEP_COMPLETED', 'COMPLETED', output);
            addLog('info', `Step ${stepId} completed successfully`);

            // ── Advance DAG frontier ──
            await advanceFrontier(runId, stepId, tenantId, output);

            return output;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger.error('Step failed', { runId, stepId, attempt: payload.attempt, error: errMsg });

            // Retry logic
            const { shouldRetry, delayMs, nextAttempt } = calculateRetryDelay(
                payload.attempt,
                payload.retryPolicy.maxAttempts,
                payload.retryPolicy.initialDelayMs,
                payload.retryPolicy.backoffMultiplier,
                payload.retryPolicy.maxDelayMs,
            );

            if (shouldRetry) {
                await db.query(
                    `UPDATE run_steps SET status = 'RETRYING', error = $1 WHERE run_id = $2 AND step_id = $3`,
                    [errMsg, runId, stepId],
                );
                await publishEvent(runId, stepId, 'STEP_FAILED', 'RETRYING');

                // Re-enqueue with delay
                const retryPayload: StepJobPayload = { ...payload, attempt: nextAttempt };
                await stepQueue.add(`step:${stepId}:retry:${nextAttempt}`, retryPayload, {
                    delay: delayMs,
                });
                logger.info('Step scheduled for retry', { runId, stepId, nextAttempt, delayMs });
            } else {
                // Exhausted retries — mark FAILED
                await db.query(
                    `UPDATE run_steps SET status = 'FAILED', error = $1, completed_at = NOW() WHERE run_id = $2 AND step_id = $3`,
                    [errMsg, runId, stepId],
                );
                await publishEvent(runId, stepId, 'STEP_FAILED', 'FAILED', undefined, errMsg);

                // Fail the entire run
                await db.query(
                    `UPDATE workflow_runs SET status = 'FAILED', error = $1, completed_at = NOW() WHERE id = $2`,
                    [`Step ${stepId} failed after ${payload.retryPolicy.maxAttempts} attempts: ${errMsg}`, runId],
                );
                await redisConn.decr(`concurrent:runs:${tenantId}`);
                await publishRunEvent(runId, 'FAILED', errMsg);

                // Mark all remaining pending steps as SKIPPED
                await db.query(
                    `UPDATE run_steps SET status = 'SKIPPED' WHERE run_id = $1 AND status IN ('PENDING', 'RETRYING')`,
                    [runId],
                );
            }
        }
    },
    { connection: redisConn, concurrency: CONCURRENCY, lockDuration: SANDBOX_TIMEOUT_MS + 5000 },
);

// ─── Frontier Advance ─────────────────────────────────────────

async function advanceFrontier(
    runId: string,
    completedStepId: string,
    tenantId: string,
    output: Record<string, unknown>,
): Promise<void> {
    // Load the workflow definition + completed step IDs
    const { rows: [run] } = await db.query<{ definition: WorkflowDefinition }>(
        `SELECT wv.definition FROM workflow_runs wr
     JOIN workflow_versions wv ON wv.id = wr.workflow_version_id
     WHERE wr.id = $1`,
        [runId],
    );
    if (!run) return;

    const { rows: completedSteps } = await db.query<{ step_id: string }>(
        `SELECT step_id FROM run_steps WHERE run_id = $1 AND status = 'COMPLETED'`,
        [runId],
    );
    const completedIds = new Set(completedSteps.map((s) => s.step_id));

    const definition = run.definition as WorkflowDefinition;
    const { ready, skipped } = getNextReadySteps(
        completedStepId,
        definition.edges,
        completedIds,
        definition.nodes,
        output,
    );

    // Mark skipped steps
    if (skipped.length > 0) {
        await db.query(
            `UPDATE run_steps SET status = 'SKIPPED' WHERE run_id = $1 AND step_id = ANY($2)`,
            [runId, skipped],
        );
    }

    // Check if run is fully complete
    const { rows: [counts] } = await db.query<{ pending: number; running: number; total: number }>(
        `SELECT
       COUNT(*) FILTER (WHERE status IN ('PENDING','RUNNING','RETRYING')) AS pending,
       COUNT(*) AS total
     FROM run_steps WHERE run_id = $1`,
        [runId],
    );

    if (ready.length === 0 && Number(counts?.pending ?? 0) === 0) {
        // All steps done
        await db.query(
            `UPDATE workflow_runs SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`,
            [runId],
        );
        await redisConn.decr(`concurrent:runs:${tenantId}`);
        await publishRunEvent(runId, 'COMPLETED');
        return;
    }

    // Enqueue ready steps
    const nodeMap = new Map(definition.nodes.map((n) => [n.id, n]));
    for (const stepId of ready) {
        const node = nodeMap.get(stepId);
        if (!node) continue;

        // Gather inputs: merge global run input + outputs from all parent steps
        const { rows: parentOutputs } = await db.query<{ output: Record<string, unknown> }>(
            `SELECT rs.output FROM run_steps rs
       JOIN (SELECT unnest($1::text[]) AS sid) parents ON parents.sid = rs.step_id
       WHERE rs.run_id = $2 AND rs.status = 'COMPLETED'`,
            [definition.edges.filter((e) => e.target === stepId).map((e) => e.source), runId],
        );
        const mergedInput = Object.assign({}, ...parentOutputs.map((p) => p.output), node.config);

        const payload: StepJobPayload = {
            runId,
            stepId,
            pluginId: node.pluginId,
            pluginVersion: node.pluginVersion,
            pluginType: node.type,
            input: mergedInput,
            attempt: 1,
            retryPolicy: node.retryPolicy ?? {
                maxAttempts: 3,
                initialDelayMs: 1000,
                backoffMultiplier: 2,
                maxDelayMs: 60_000,
            },
            idempotencyKey: `${runId}:${stepId}:1`,
            tenantId,
        };
        await stepQueue.add(`step:${stepId}`, payload);
    }
}

// ─── Helpers ─────────────────────────────────────────────────

async function markStepStatus(runId: string, stepId: string, status: string, attempt: number) {
    await db.query(
        `UPDATE run_steps SET status = $1, attempt = $2 WHERE run_id = $3 AND step_id = $4`,
        [status, attempt, runId, stepId],
    );
}

async function publishEvent(
    runId: string, stepId: string, eventType: string, status: string,
    output?: Record<string, unknown>, error?: string,
) {
    await redisConn.publish(`run:${runId}`, JSON.stringify({
        type: 'STEP_UPDATE', runId, stepId, eventType, status, output, error,
        ts: new Date().toISOString(),
    }));
}

async function publishLogEvent(runId: string, stepId: string, log: StepLog) {
    await redisConn.publish(`run:${runId}`, JSON.stringify({
        type: 'STEP_UPDATE', runId, stepId, eventType: 'STEP_LOG', log,
        ts: new Date().toISOString(),
    }));
}

async function publishRunEvent(runId: string, status: string, error?: string) {
    await redisConn.publish(`run:${runId}`, JSON.stringify({
        type: 'RUN_UPDATE', runId, status, error, ts: new Date().toISOString(),
    }));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Graceful Shutdown ────────────────────────────────────────

worker.on('error', (err) => logger.error('Worker error', err));

const shutdown = async (signal: string) => {
    logger.info(`${signal} — closing worker`);
    await worker.close();
    await redisConn.quit();
    await db.end();
    process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

logger.info('Worker started', { concurrency: CONCURRENCY });
