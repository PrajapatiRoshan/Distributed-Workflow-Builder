// ============================================================
// Shared Types — Distributed Workflow Builder
// ============================================================

// ─── Enums ──────────────────────────────────────────────────

export type UserRole = 'admin' | 'user';
export type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type RunStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'CANCELLED' | 'COMPLETED' | 'FAILED';
export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'RETRYING';
export type PluginType = 'TEXT_TRANSFORM' | 'API_PROXY' | 'DATA_AGGREGATOR' | 'DELAY' | 'CUSTOM';
export type PluginStatus = 'PENDING_REVIEW' | 'PUBLISHED' | 'DEPRECATED' | 'REJECTED';

// ─── Tenant & User ──────────────────────────────────────────

export interface Tenant {
    id: string;
    name: string;
    plan: TenantPlan;
    createdAt: string;
    updatedAt: string;
}

export interface User {
    id: string;
    tenantId: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface JWTPayload {
    sub: string;       // userId
    tid: string;       // tenantId
    role: UserRole;
    iat: number;
    exp: number;
}

// ─── DAG / Workflow ─────────────────────────────────────────

export interface WorkflowNode {
    id: string;
    type: PluginType;
    pluginId: string;
    pluginVersion: string;
    label: string;
    config: Record<string, unknown>;
    position: { x: number; y: number };
    /** Optional retry override */
    retryPolicy?: RetryPolicy;
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    /** For branching: 'true' | 'false' | undefined (unconditional) */
    condition?: string;
    /** JS expression evaluated against source step output */
    conditionExpression?: string;
}

export interface WorkflowDefinition {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    globalInput?: Record<string, unknown>;
}

export interface Workflow {
    id: string;
    tenantId: string;
    ownerId: string;
    name: string;
    description?: string;
    currentVersionId?: string;
    isPublished: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface WorkflowVersion {
    id: string;
    workflowId: string;
    version: number;
    definition: WorkflowDefinition;
    changelog?: string;
    createdBy: string;
    createdAt: string;
}

// ─── Execution ──────────────────────────────────────────────

export interface RetryPolicy {
    maxAttempts: number;
    initialDelayMs: number;
    backoffMultiplier: number;
    maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 60_000,
};

export interface WorkflowRun {
    id: string;
    tenantId: string;
    workflowVersionId: string;
    triggeredBy?: string;
    status: RunStatus;
    idempotencyKey?: string;
    input?: Record<string, unknown>;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
}

export interface RunStep {
    id: string;
    runId: string;
    stepId: string;
    pluginId?: string;
    status: StepStatus;
    attempt: number;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
    logs?: StepLog[];
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
}

export interface StepLog {
    ts: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    meta?: Record<string, unknown>;
}

// NDJSON event shape emitted on the log stream
export interface RunLogEvent {
    runId: string;
    stepId?: string;
    eventType: 'RUN_STARTED' | 'STEP_STARTED' | 'STEP_LOG' | 'STEP_COMPLETED' | 'STEP_FAILED' | 'RUN_COMPLETED' | 'RUN_FAILED' | 'RUN_PAUSED' | 'RUN_CANCELLED';
    status?: RunStatus | StepStatus;
    log?: StepLog;
    output?: Record<string, unknown>;
    error?: string;
    ts: string;
}

// ─── Plugin ─────────────────────────────────────────────────

export interface JSONSchema {
    type: string;
    properties?: Record<string, JSONSchema>;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
}

export interface PluginSchema {
    input: JSONSchema;
    output: JSONSchema;
}

export interface Plugin {
    id: string;
    tenantId?: string;
    authorId: string;
    name: string;
    slug: string;
    description?: string;
    version: string;
    pluginType: PluginType;
    schema: PluginSchema;
    artifactUrl?: string;
    isPaid: boolean;
    priceCents: number;
    rating: number;
    reviewsCount: number;
    status: PluginStatus;
    createdAt: string;
    updatedAt: string;
}

// ─── API Response Shapes ────────────────────────────────────

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    cursor?: string;
    hasNext: boolean;
}

// ─── WebSocket Events ───────────────────────────────────────

export interface WsRunEvent {
    type: 'RUN_UPDATE' | 'STEP_UPDATE';
    runId: string;
    stepId?: string;
    status: RunStatus | StepStatus;
    output?: Record<string, unknown>;
    error?: string;
    ts: string;
}

// ─── Queue Job Payloads ─────────────────────────────────────

export interface StepJobPayload {
    runId: string;
    stepId: string;
    pluginId: string;
    pluginVersion: string;
    pluginType: PluginType;
    input: Record<string, unknown>;
    attempt: number;
    retryPolicy: RetryPolicy;
    idempotencyKey: string;
    tenantId: string;
}
