import { buildExecutionPlan, detectCycles, calculateRetryDelay, getNextReadySteps } from '../src/index';
import { validateWorkflowDefinition } from '../src/validator';
import type { WorkflowDefinition } from '@wfb/shared-types';

// ─── Helper ──────────────────────────────────────────────────
function makeNode(id: string) {
    return {
        id,
        type: 'CUSTOM' as const,
        pluginId: `plugin-${id}`,
        pluginVersion: '1.0.0',
        label: id,
        config: {},
        position: { x: 0, y: 0 },
    };
}

function makeEdge(id: string, source: string, target: string) {
    return { id, source, target };
}

// ─── Cycle Detection ─────────────────────────────────────────

describe('detectCycles', () => {
    it('returns no cycle for a linear DAG', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
            edges: [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
        };
        expect(detectCycles(def).hasCycle).toBe(false);
    });

    it('detects a direct cycle a→b→a', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a'), makeNode('b')],
            edges: [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'a')],
        };
        const result = detectCycles(def);
        expect(result.hasCycle).toBe(true);
    });

    it('detects a transitive cycle a→b→c→a', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
            edges: [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c'), makeEdge('e3', 'c', 'a')],
        };
        expect(detectCycles(def).hasCycle).toBe(true);
    });

    it('handles disconnected DAG with no cycle', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')],
            edges: [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'c', 'd')],
        };
        expect(detectCycles(def).hasCycle).toBe(false);
    });
});

// ─── Execution Plan / Topological Sort ───────────────────────

describe('buildExecutionPlan', () => {
    it('produces a single wave for nodes with no edges', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a'), makeNode('b')],
            edges: [],
        };
        const plan = buildExecutionPlan(def);
        expect(plan.waves).toHaveLength(1);
        expect(plan.waves[0]!.steps.sort()).toEqual(['a', 'b']);
    });

    it('produces sequential waves for a chain', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
            edges: [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
        };
        const plan = buildExecutionPlan(def);
        expect(plan.waves).toHaveLength(3);
        expect(plan.waves[0]!.steps).toEqual(['a']);
        expect(plan.waves[1]!.steps).toEqual(['b']);
        expect(plan.waves[2]!.steps).toEqual(['c']);
    });

    it('groups parallel siblings in the same wave', () => {
        // a → b, a → c, b → d, c → d
        const def: WorkflowDefinition = {
            nodes: [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')],
            edges: [
                makeEdge('e1', 'a', 'b'),
                makeEdge('e2', 'a', 'c'),
                makeEdge('e3', 'b', 'd'),
                makeEdge('e4', 'c', 'd'),
            ],
        };
        const plan = buildExecutionPlan(def);
        expect(plan.waves[0]!.steps).toEqual(['a']);
        // b and c should be in the same wave, sorted
        expect(plan.waves[1]!.steps).toEqual(['b', 'c']);
        expect(plan.waves[2]!.steps).toEqual(['d']);
    });

    it('is deterministic — same input always same output', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('z'), makeNode('a'), makeNode('m'), makeNode('b')],
            edges: [makeEdge('e1', 'z', 'b'), makeEdge('e2', 'z', 'm'), makeEdge('e3', 'a', 'b')],
        };
        const plan1 = buildExecutionPlan(def);
        const plan2 = buildExecutionPlan(def);
        expect(plan1.waves).toEqual(plan2.waves);
    });

    it('throws on a cyclic graph', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a'), makeNode('b')],
            edges: [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'a')],
        };
        expect(() => buildExecutionPlan(def)).toThrow(/Cycle detected/);
    });
});

// ─── Retry Calculator ────────────────────────────────────────

describe('calculateRetryDelay', () => {
    it('returns shouldRetry=false when attempts exhausted', () => {
        const result = calculateRetryDelay(3, 3, 1000, 2, 60000);
        expect(result.shouldRetry).toBe(false);
    });

    it('returns increasing delays for each attempt', () => {
        const d1 = calculateRetryDelay(1, 5, 1000, 2, 60000);
        const d2 = calculateRetryDelay(2, 5, 1000, 2, 60000);
        const d3 = calculateRetryDelay(3, 5, 1000, 2, 60000);
        expect(d1.shouldRetry).toBe(true);
        expect(d2.delayMs).toBeGreaterThanOrEqual(d1.delayMs);
        expect(d3.delayMs).toBeGreaterThanOrEqual(d2.delayMs);
    });

    it('caps delay at maxDelayMs', () => {
        const result = calculateRetryDelay(10, 15, 1000, 2, 5000);
        expect(result.delayMs).toBeLessThanOrEqual(5000);
    });
});

// ─── Workflow Validator ───────────────────────────────────────

describe('validateWorkflowDefinition', () => {
    it('passes for a valid workflow', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a'), makeNode('b')],
            edges: [makeEdge('e1', 'a', 'b')],
        };
        expect(validateWorkflowDefinition(def).valid).toBe(true);
    });

    it('fails for empty nodes', () => {
        const def: WorkflowDefinition = { nodes: [], edges: [] };
        const result = validateWorkflowDefinition(def);
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.path).toBe('nodes');
    });

    it('fails for edge referencing unknown node', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a')],
            edges: [makeEdge('e1', 'a', 'nonexistent')],
        };
        const result = validateWorkflowDefinition(def);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('nonexistent'))).toBe(true);
    });

    it('fails for self-loop', () => {
        const def: WorkflowDefinition = {
            nodes: [makeNode('a')],
            edges: [makeEdge('e1', 'a', 'a')],
        };
        const result = validateWorkflowDefinition(def);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('Self-loop'))).toBe(true);
    });
});
