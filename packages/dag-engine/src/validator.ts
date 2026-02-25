import type { WorkflowDefinition } from '@wfb/shared-types';

export interface ValidationError {
    path: string;
    message: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * Validates a workflow definition for structural correctness:
 * - All edge sources/targets reference existing node ids
 * - No duplicate node ids
 * - No duplicate edge ids
 * - At least one node
 * - No orphaned edges
 */
export function validateWorkflowDefinition(def: WorkflowDefinition): ValidationResult {
    const errors: ValidationError[] = [];
    const { nodes, edges } = def;

    if (nodes.length === 0) {
        errors.push({ path: 'nodes', message: 'Workflow must have at least one node' });
        return { valid: false, errors };
    }

    // Check duplicate node ids
    const nodeIds = new Set<string>();
    for (const node of nodes) {
        if (!node.id) {
            errors.push({ path: 'nodes', message: 'Node is missing an id' });
        } else if (nodeIds.has(node.id)) {
            errors.push({ path: `nodes.${node.id}`, message: `Duplicate node id: ${node.id}` });
        } else {
            nodeIds.add(node.id);
        }
        if (!node.pluginId) {
            errors.push({ path: `nodes.${node.id}.pluginId`, message: 'Node is missing pluginId' });
        }
    }

    // Check duplicate edge ids
    const edgeIds = new Set<string>();
    for (const edge of edges) {
        if (!edge.id) {
            errors.push({ path: 'edges', message: 'Edge is missing an id' });
        } else if (edgeIds.has(edge.id)) {
            errors.push({ path: `edges.${edge.id}`, message: `Duplicate edge id: ${edge.id}` });
        } else {
            edgeIds.add(edge.id);
        }

        // Validate source/target exist
        if (!nodeIds.has(edge.source)) {
            errors.push({
                path: `edges.${edge.id}.source`,
                message: `Edge references unknown source node: ${edge.source}`,
            });
        }
        if (!nodeIds.has(edge.target)) {
            errors.push({
                path: `edges.${edge.id}.target`,
                message: `Edge references unknown target node: ${edge.target}`,
            });
        }
        if (edge.source === edge.target) {
            errors.push({
                path: `edges.${edge.id}`,
                message: `Self-loop detected on node: ${edge.source}`,
            });
        }
    }

    return { valid: errors.length === 0, errors };
}
