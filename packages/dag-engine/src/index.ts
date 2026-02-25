import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '@wfb/shared-types';

// ─── Types ───────────────────────────────────────────────────

export interface CycleDetectionResult {
    hasCycle: boolean;
    cycle?: string[];
}

export interface ExecutionWave {
    wave: number;
    steps: string[];
}

export interface ExecutionPlan {
    waves: ExecutionWave[];
    /** Deterministic ordering: nodes in each wave sorted lexicographically by id */
    nodeMap: Map<string, WorkflowNode>;
    adjacencyList: Map<string, string[]>;
    inDegreeMap: Map<string, number>;
}

export interface BranchResolution {
    nextStepIds: string[];
    skippedStepIds: string[];
}

// ─── Cycle Detection (DFS) ──────────────────────────────────

export function detectCycles(definition: WorkflowDefinition): CycleDetectionResult {
    const { nodes, edges } = definition;
    const adjacency = buildAdjacency(nodes, edges);
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cycleNodes: string[] = [];

    function dfs(nodeId: string): boolean {
        visited.add(nodeId);
        inStack.add(nodeId);

        const neighbors = adjacency.get(nodeId) ?? [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                if (dfs(neighbor)) {
                    cycleNodes.push(neighbor);
                    return true;
                }
            } else if (inStack.has(neighbor)) {
                cycleNodes.push(neighbor);
                return true;
            }
        }

        inStack.delete(nodeId);
        return false;
    }

    for (const node of nodes) {
        if (!visited.has(node.id)) {
            if (dfs(node.id)) {
                return { hasCycle: true, cycle: cycleNodes };
            }
        }
    }

    return { hasCycle: false };
}

// ─── Topological Sort — Kahn's Algorithm ────────────────────

export function buildExecutionPlan(definition: WorkflowDefinition): ExecutionPlan {
    const { nodes, edges } = definition;

    const cycleCheck = detectCycles(definition);
    if (cycleCheck.hasCycle) {
        throw new Error(`Cycle detected in workflow DAG: ${cycleCheck.cycle?.join(' → ')}`);
    }

    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of nodes) {
        nodeMap.set(node.id, node);
    }

    const adjacencyList = buildAdjacency(nodes, edges);
    const inDegreeMap = new Map<string, number>();

    // Initialize all in-degrees to 0
    for (const node of nodes) {
        inDegreeMap.set(node.id, 0);
    }
    // Compute in-degrees
    for (const [, neighbors] of adjacencyList) {
        for (const neighbor of neighbors) {
            inDegreeMap.set(neighbor, (inDegreeMap.get(neighbor) ?? 0) + 1);
        }
    }

    const waves: ExecutionWave[] = [];
    let waveNum = 0;

    // Kahn's BFS in waves (for parallelism groups)
    while (true) {
        // Deterministic: sort nodes by id before selecting zero-in-degree set
        const ready = [...inDegreeMap.entries()]
            .filter(([, deg]) => deg === 0)
            .map(([id]) => id)
            .sort(); // lexicographic sort for determinism

        if (ready.length === 0) break;

        waves.push({ wave: waveNum++, steps: ready });

        for (const nodeId of ready) {
            inDegreeMap.delete(nodeId);
            const neighbors = adjacencyList.get(nodeId) ?? [];
            // Sort neighbors for deterministic edge processing
            const sortedNeighbors = [...neighbors].sort();
            for (const neighbor of sortedNeighbors) {
                const deg = inDegreeMap.get(neighbor) ?? 0;
                inDegreeMap.set(neighbor, deg - 1);
            }
        }
    }

    return { waves, nodeMap, adjacencyList, inDegreeMap };
}

// ─── Branch Resolution ───────────────────────────────────────

export function resolveBranch(
    sourceNodeId: string,
    edges: WorkflowEdge[],
    stepOutput: Record<string, unknown>,
): BranchResolution {
    const outgoingEdges = edges.filter((e) => e.source === sourceNodeId);
    const nextStepIds: string[] = [];
    const skippedStepIds: string[] = [];

    for (const edge of outgoingEdges) {
        // Unconditional edge
        if (!edge.condition && !edge.conditionExpression) {
            nextStepIds.push(edge.target);
            continue;
        }

        // Named condition (true/false branch)
        if (edge.conditionExpression) {
            const result = evaluateExpression(edge.conditionExpression, stepOutput);
            if (result) {
                nextStepIds.push(edge.target);
            } else {
                skippedStepIds.push(edge.target);
            }
        } else if (edge.condition === 'true') {
            // Evaluate boolean field from output
            const boolResult = Boolean(stepOutput['result'] ?? stepOutput['success'] ?? true);
            if (boolResult) nextStepIds.push(edge.target);
            else skippedStepIds.push(edge.target);
        } else if (edge.condition === 'false') {
            const boolResult = Boolean(stepOutput['result'] ?? stepOutput['success'] ?? true);
            if (!boolResult) nextStepIds.push(edge.target);
            else skippedStepIds.push(edge.target);
        }
    }

    return { nextStepIds, skippedStepIds };
}

// ─── Expression Evaluator (sandboxed subset) ────────────────

function evaluateExpression(expression: string, context: Record<string, unknown>): boolean {
    // Whitelist: only allow simple property access and comparisons
    const allowedPattern = /^[\w.\s=!<>&|'"()]+$/;
    if (!allowedPattern.test(expression)) {
        throw new Error(`Unsafe branch expression: ${expression}`);
    }
    try {
        // Build a safe function with only context variables in scope
        const keys = Object.keys(context);
        const values = Object.values(context);
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn = new Function(...keys, `"use strict"; return Boolean(${expression})`);
        return fn(...values) as boolean;
    } catch {
        return false;
    }
}

// ─── Retry Calculator ───────────────────────────────────────

export interface RetryDelay {
    shouldRetry: boolean;
    delayMs: number;
    nextAttempt: number;
}

export function calculateRetryDelay(
    attempt: number,
    maxAttempts: number,
    initialDelayMs: number,
    backoffMultiplier: number,
    maxDelayMs: number,
): RetryDelay {
    if (attempt >= maxAttempts) {
        return { shouldRetry: false, delayMs: 0, nextAttempt: attempt };
    }
    // Exponential backoff with jitter: delay = min(initial * multiplier^attempt, max) + jitter
    const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
    const jitter = Math.floor(exponentialDelay * 0.1 * Math.random()); // ±10%
    const delayMs = Math.min(exponentialDelay + jitter, maxDelayMs);
    return { shouldRetry: true, delayMs: Math.floor(delayMs), nextAttempt: attempt + 1 };
}

// ─── Helper ─────────────────────────────────────────────────

function buildAdjacency(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
        adjacency.set(node.id, []);
    }
    for (const edge of edges) {
        const existing = adjacency.get(edge.source) ?? [];
        existing.push(edge.target);
        adjacency.set(edge.source, existing);
    }
    return adjacency;
}

// ─── Frontier Calculator ─────────────────────────────────────
// After a step completes, determine which new steps become "ready"

export function getNextReadySteps(
    completedStepId: string,
    edges: WorkflowEdge[],
    completedStepIds: Set<string>,
    allNodes: WorkflowNode[],
    stepOutput: Record<string, unknown>,
): { ready: string[]; skipped: string[] } {
    const { nextStepIds, skippedStepIds } = resolveBranch(completedStepId, edges, stepOutput);

    const ready: string[] = [];
    for (const candidateId of nextStepIds) {
        // A step is ready when ALL its predecessors are completed
        const predecessors = edges
            .filter((e) => e.target === candidateId)
            .map((e) => e.source);
        const allPredsDone = predecessors.every((p) => completedStepIds.has(p));
        if (allPredsDone) {
            ready.push(candidateId);
        }
    }

    // Sort for determinism
    ready.sort();
    skippedStepIds.sort();

    return { ready, skipped: skippedStepIds };
}

export * from './validator';
