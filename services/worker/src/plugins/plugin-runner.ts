import { createHash } from 'crypto';
import Docker from 'dockerode';
import type { StepJobPayload, StepLog, PluginType } from '@wfb/shared-types';

type LogFn = (level: StepLog['level'], message: string, meta?: Record<string, unknown>) => void;

// ─── In-Process Plugin Runner ────────────────────────────────
// Runs built-in plugins in-process (no Docker overhead for trusted types)
// Custom plugins use Docker sandboxing

export async function runPluginInProcess(
    payload: StepJobPayload,
    docker: Docker,
    timeoutMs: number,
    log: LogFn,
): Promise<Record<string, unknown>> {
    const { pluginType, input } = payload;

    switch (pluginType) {
        case 'TEXT_TRANSFORM':
            return runTextTransform(input, log);
        case 'API_PROXY':
            return runApiProxy(input, log, timeoutMs);
        case 'DATA_AGGREGATOR':
            return runDataAggregator(input, log);
        case 'DELAY':
            return runDelay(input, log);
        case 'CUSTOM':
            return runInDockerSandbox(payload, docker, timeoutMs, log);
        default:
            throw new Error(`Unknown plugin type: ${String(pluginType)}`);
    }
}

// ─── TEXT_TRANSFORM ──────────────────────────────────────────

function caesarCipher(text: string, shift: number): string {
    return text.replace(/[a-zA-Z]/g, (char) => {
        const base = char >= 'a' ? 97 : 65;
        return String.fromCharCode(((char.charCodeAt(0) - base + shift) % 26) + base);
    });
}

function runTextTransform(input: Record<string, unknown>, log: LogFn): Record<string, unknown> {
    const text = String(input['text'] ?? '');
    const shift = Number(input['shift'] ?? 3);

    log('info', 'Applying Caesar cipher', { shift });
    const ciphered = caesarCipher(text, shift);

    log('info', 'Reversing text');
    const reversed = ciphered.split('').reverse().join('');

    log('info', 'Computing SHA-256 checksum');
    const checksum = createHash('sha256').update(reversed).digest('hex');

    return {
        original: text,
        ciphered,
        reversed,
        checksum,
        length: reversed.length,
    };
}

// ─── API_PROXY ───────────────────────────────────────────────

const apiProxyCache = new Map<string, { data: unknown; expiresAt: number }>();

async function runApiProxy(
    input: Record<string, unknown>,
    log: LogFn,
    timeoutMs: number,
): Promise<Record<string, unknown>> {
    const url = String(input['url'] ?? '');
    const method = String(input['method'] ?? 'GET').toUpperCase();
    const headers = (input['headers'] ?? {}) as Record<string, string>;
    const useCache = Boolean(input['useCache'] ?? true);
    const bypassCache = Boolean(input['bypassCache'] ?? false);

    if (!url || !url.startsWith('http')) {
        throw new Error(`Invalid URL: ${url}`);
    }

    const cacheKey = `${method}:${url}`;
    if (useCache && !bypassCache) {
        const cached = apiProxyCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            log('info', 'Cache hit', { url });
            return { status: 200, data: cached.data, cached: true, url };
        }
    }

    log('info', 'Fetching URL', { url, method });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            signal: controller.signal,
        });

        const text = await response.text();
        let data: unknown;
        try { data = JSON.parse(text); } catch { data = text; }

        if (useCache && !bypassCache && response.ok) {
            apiProxyCache.set(cacheKey, { data, expiresAt: Date.now() + 60_000 });
        }

        log('info', 'HTTP response received', { status: response.status });
        return { status: response.status, data, cached: false, url };
    } finally {
        clearTimeout(timer);
    }
}

// ─── DATA_AGGREGATOR ─────────────────────────────────────────

function runDataAggregator(input: Record<string, unknown>, log: LogFn): Record<string, unknown> {
    log('info', 'Aggregating step outputs');

    // Input is expected to be a map of stepId → outputs
    const summaryMap: Record<string, unknown> = {};
    let totalKeys = 0;
    let totalValues = 0;

    for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'object' && value !== null) {
            const keys = Object.keys(value as object);
            summaryMap[key] = {
                keyCount: keys.length,
                checksum: createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16),
                keys,
            };
            totalKeys += keys.length;
        } else {
            summaryMap[key] = { value, type: typeof value };
        }
        totalValues++;
    }

    log('info', 'Aggregation complete', { totalValues, totalKeys });
    return {
        summary: summaryMap,
        totalInputs: totalValues,
        totalKeys,
        aggregatedAt: new Date().toISOString(),
    };
}

// ─── DELAY ───────────────────────────────────────────────────

async function runDelay(input: Record<string, unknown>, log: LogFn): Promise<Record<string, unknown>> {
    const durationMs = Math.min(Number(input['durationMs'] ?? 1000), 30_000);
    const blocking = Boolean(input['blocking'] ?? false);

    log('info', `Delay started: ${durationMs}ms`, { blocking });

    if (blocking) {
        // Synchronous busy-wait (only for small durations — demo purposes)
        const start = Date.now();
        while (Date.now() - start < durationMs) { /* busy wait */ }
    } else {
        await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
    }

    log('info', 'Delay completed');
    return { durationMs, blocking, completedAt: new Date().toISOString() };
}

// ─── Docker Sandbox (CUSTOM plugins) ─────────────────────────

async function runInDockerSandbox(
    payload: StepJobPayload,
    docker: Docker,
    timeoutMs: number,
    log: LogFn,
): Promise<Record<string, unknown>> {
    log('info', 'Spawning Docker sandbox container');

    const inputJson = JSON.stringify(payload.input);

    const container = await docker.createContainer({
        Image: 'node:20-alpine',
        Cmd: ['node', '-e', `
      const input = ${inputJson};
      // Plugin code would be injected here from artifact
      const output = { processed: true, input, ts: new Date().toISOString() };
      process.stdout.write(JSON.stringify(output));
    `],
        HostConfig: {
            Memory: parseInt((process.env['SANDBOX_MEMORY_LIMIT'] ?? '268435456').replace('m', '')) * (process.env['SANDBOX_MEMORY_LIMIT']?.includes('m') ? 1024 * 1024 : 1),
            NanoCpus: Math.floor(parseFloat(process.env['SANDBOX_CPU_LIMIT'] ?? '0.5') * 1e9),
            NetworkMode: 'none',
            ReadonlyRootfs: true,
            Tmpfs: { '/tmp': 'size=10m' },
            CapDrop: ['ALL'],
            SecurityOpt: ['no-new-privileges'],
            PidsLimit: 64,
            AutoRemove: false,
        },
        NetworkDisabled: true,
        AttachStdout: true,
        AttachStderr: true,
    });

    const timeoutHandle = setTimeout(async () => {
        try { await container.stop({ t: 0 }); } catch { /* ignore */ }
    }, timeoutMs);

    try {
        await container.start();

        const stream = await container.logs({ stdout: true, stderr: true, follow: true });
        let stdout = '';
        let stderr = '';

        await new Promise<void>((resolve, reject) => {
            if (Buffer.isBuffer(stream)) {
                stdout = stream.toString();
                resolve();
                return;
            }
            (stream as NodeJS.ReadableStream).on('data', (chunk: Buffer) => {
                // Docker multiplexed stream: first byte = stream type (1=stdout, 2=stderr)
                if (chunk[0] === 1) stdout += chunk.slice(8).toString();
                else if (chunk[0] === 2) stderr += chunk.slice(8).toString();
                else stdout += chunk.toString(); // fallback
            });
            (stream as NodeJS.ReadableStream).on('end', resolve);
            (stream as NodeJS.ReadableStream).on('error', reject);
        });

        const { StatusCode } = await container.wait();
        clearTimeout(timeoutHandle);

        if (StatusCode !== 0) {
            throw new Error(`Plugin container exited with code ${StatusCode}: ${stderr}`);
        }

        if (stderr) log('warn', 'Plugin stderr', { stderr: stderr.slice(0, 500) });

        try {
            return JSON.parse(stdout) as Record<string, unknown>;
        } catch {
            throw new Error(`Plugin output is not valid JSON: ${stdout.slice(0, 200)}`);
        }
    } finally {
        clearTimeout(timeoutHandle);
        try { await container.remove({ force: true }); } catch { /* ignore cleanup errors */ }
    }
}
