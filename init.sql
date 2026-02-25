-- ============================================================
-- Distributed Workflow Builder — PostgreSQL Init Schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tenants ────────────────────────────────────────────────
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    plan        VARCHAR(50)  NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','pro','enterprise')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Users ──────────────────────────────────────────────────
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       VARCHAR(320) NOT NULL,
    pw_hash     VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ─── Refresh Tokens ─────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ─── Workflows ──────────────────────────────────────────────
CREATE TABLE workflows (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_id            UUID         NOT NULL REFERENCES users(id),
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    current_version_id  UUID,   -- FK set after first version created
    is_published        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX idx_workflows_owner ON workflows(owner_id);

-- ─── Workflow Versions (immutable snapshots) ─────────────────
CREATE TABLE workflow_versions (
    id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id  UUID    NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version      INTEGER NOT NULL,
    definition   JSONB   NOT NULL,  -- { nodes: [], edges: [] }
    changelog    TEXT,
    created_by   UUID    NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workflow_id, version)
);
CREATE INDEX idx_wv_workflow ON workflow_versions(workflow_id);
CREATE INDEX idx_wv_definition ON workflow_versions USING GIN(definition);

-- Back-ref from workflows to current version
ALTER TABLE workflows ADD CONSTRAINT fk_current_version
    FOREIGN KEY (current_version_id) REFERENCES workflow_versions(id) DEFERRABLE INITIALLY DEFERRED;

-- ─── Workflow Runs ──────────────────────────────────────────
CREATE TABLE workflow_runs (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id            UUID         NOT NULL REFERENCES tenants(id),
    workflow_version_id  UUID         NOT NULL REFERENCES workflow_versions(id),
    triggered_by         UUID         REFERENCES users(id),
    status               VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING','RUNNING','PAUSED','CANCELLED','COMPLETED','FAILED')),
    idempotency_key      VARCHAR(255),
    input                JSONB,
    error                TEXT,
    started_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX idx_runs_tenant ON workflow_runs(tenant_id);
CREATE INDEX idx_runs_status ON workflow_runs(status);
CREATE INDEX idx_runs_version ON workflow_runs(workflow_version_id);

-- ─── Run Steps ──────────────────────────────────────────────
CREATE TABLE run_steps (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id       UUID         NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id      VARCHAR(255) NOT NULL,
    plugin_id    UUID,
    status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','SKIPPED','RETRYING')),
    attempt      INTEGER      NOT NULL DEFAULT 1,
    input        JSONB,
    output       JSONB,
    error        TEXT,
    logs         JSONB,       -- array of {ts, level, message}
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms  INTEGER,
    UNIQUE (run_id, step_id, attempt)
);
CREATE INDEX idx_steps_run ON run_steps(run_id);
CREATE INDEX idx_steps_status ON run_steps(status);

-- ─── Plugins ────────────────────────────────────────────────
CREATE TABLE plugins (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID         REFERENCES tenants(id),  -- NULL = global/marketplace
    author_id     UUID         NOT NULL REFERENCES users(id),
    name          VARCHAR(255) NOT NULL,
    slug          VARCHAR(255) NOT NULL UNIQUE,
    description   TEXT,
    version       VARCHAR(50)  NOT NULL,
    plugin_type   VARCHAR(50)  NOT NULL CHECK (plugin_type IN ('TEXT_TRANSFORM','API_PROXY','DATA_AGGREGATOR','DELAY','CUSTOM')),
    schema        JSONB        NOT NULL,  -- { input: JSONSchema, output: JSONSchema }
    artifact_url  VARCHAR(500),
    is_paid       BOOLEAN      NOT NULL DEFAULT FALSE,
    price_cents   INTEGER      NOT NULL DEFAULT 0,
    rating        DECIMAL(3,2) NOT NULL DEFAULT 0,
    reviews_count INTEGER      NOT NULL DEFAULT 0,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING_REVIEW'
                    CHECK (status IN ('PENDING_REVIEW','PUBLISHED','DEPRECATED','REJECTED')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_plugins_slug ON plugins(slug);
CREATE INDEX idx_plugins_type ON plugins(plugin_type);
CREATE INDEX idx_plugins_status ON plugins(status);

-- ─── Plugin Reviews ─────────────────────────────────────────
CREATE TABLE plugin_reviews (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plugin_id  UUID        NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id),
    rating     SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plugin_id, user_id)
);

-- ─── Audit Logs (append-only, partitioned) ──────────────────
CREATE TABLE audit_logs (
    id            UUID        DEFAULT uuid_generate_v4(),
    tenant_id     UUID        NOT NULL,
    user_id       UUID,
    action        VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id   UUID,
    metadata      JSONB,
    ip_address    INET,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for current + next 3 months
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ─── Updated_at trigger function ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at    BEFORE UPDATE ON tenants    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_workflows_updated_at  BEFORE UPDATE ON workflows  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_plugins_updated_at    BEFORE UPDATE ON plugins    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Seed default tenant and admin ──────────────────────────
INSERT INTO tenants (id, name, plan) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'pro');

-- Default admin password = 'Admin@123' (bcrypt hash, must change in production)
INSERT INTO users (id, tenant_id, email, pw_hash, role) VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'admin@wfb.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewgItFg0gCMI8C36',
    'admin'
);

-- ─── Seed Plugins for Marketplace ─────────────────────────────
INSERT INTO plugins (id, tenant_id, author_id, name, slug, description, version, plugin_type, schema, is_paid, price_cents, rating, reviews_count, status)
VALUES
    (
        '00000000-0000-0000-0000-000000000101',
        NULL,
        '00000000-0000-0000-0000-000000000002',
        'Text Transformer',
        'text-transformer',
        'Transform text with various operations including uppercase, lowercase, reverse, Caesar cipher, and SHA-256 hashing.',
        '1.0.0',
        'TEXT_TRANSFORM',
        '{"input":{"type":"object","properties":{"text":{"type":"string","description":"The text to transform"},"operation":{"type":"string","enum":["uppercase","lowercase","reverse","caesar","sha256"],"description":"The transformation operation"},"shift":{"type":"number","description":"Shift amount for Caesar cipher"}},"required":["text","operation"]},"output":{"type":"object","properties":{"result":{"type":"string","description":"Transformed text"}}}}',
        FALSE,
        0,
        4.5,
        12,
        'PUBLISHED'
    ),
    (
        '00000000-0000-0000-0000-000000000102',
        NULL,
        '00000000-0000-0000-0000-000000000002',
        'HTTP Request',
        'http-request',
        'Make HTTP API calls to external services. Supports GET, POST, PUT, PATCH, DELETE methods with custom headers and body.',
        '1.0.0',
        'API_PROXY',
        '{"input":{"type":"object","properties":{"url":{"type":"string","description":"The URL to call"},"method":{"type":"string","enum":["GET","POST","PUT","PATCH","DELETE"],"default":"GET"},"headers":{"type":"object","description":"Custom headers"},"body":{"type":"object","description":"Request body for POST/PUT/PATCH"},"timeout":{"type":"number","default":30000,"description":"Timeout in milliseconds"}},"required":["url"]},"output":{"type":"object","properties":{"status":{"type":"number"},"headers":{"type":"object"},"data":{"type":"object"}}}}',
        FALSE,
        0,
        4.8,
        25,
        'PUBLISHED'
    ),
    (
        '00000000-0000-0000-0000-000000000103',
        NULL,
        '00000000-0000-0000-0000-000000000002',
        'Delay',
        'delay',
        'Add a configurable delay between workflow steps. Useful for rate limiting or waiting for external processes.',
        '1.0.0',
        'DELAY',
        '{"input":{"type":"object","properties":{"delayMs":{"type":"number","minimum":100,"maximum":60000,"default":1000,"description":"Delay duration in milliseconds"}},"required":["delayMs"]},"output":{"type":"object","properties":{"waited":{"type":"number","description":"Actual time waited in ms"}}}}',
        FALSE,
        0,
        4.2,
        8,
        'PUBLISHED'
    ),
    (
        '00000000-0000-0000-0000-000000000104',
        NULL,
        '00000000-0000-0000-0000-000000000002',
        'Data Aggregator',
        'data-aggregator',
        'Combine and aggregate data from multiple workflow steps. Supports merge, concatenate, and sum operations.',
        '1.0.0',
        'DATA_AGGREGATOR',
        '{"input":{"type":"object","properties":{"inputs":{"type":"array","description":"Array of inputs to aggregate"},"operation":{"type":"string","enum":["merge","concat","sum"],"default":"merge","description":"Aggregation operation"}},"required":["inputs"]},"output":{"type":"object","properties":{"result":{"type":"object","description":"Aggregated result"},"count":{"type":"number","description":"Number of inputs aggregated"}}}}',
        FALSE,
        0,
        4.0,
        5,
        'PUBLISHED'
    ),
    (
        '00000000-0000-0000-0000-000000000105',
        NULL,
        '00000000-0000-0000-0000-000000000002',
        'JSON Parser',
        'json-parser',
        'Parse and extract data from JSON using JSONPath expressions. Perfect for API response processing.',
        '1.0.0',
        'CUSTOM',
        '{"input":{"type":"object","properties":{"json":{"type":"object","description":"JSON data to parse"},"path":{"type":"string","description":"JSONPath expression"}},"required":["json","path"]},"output":{"type":"object","properties":{"result":{"description":"Extracted value(s)"}}}}',
        FALSE,
        0,
        4.3,
        10,
        'PUBLISHED'
    ),
    (
        '00000000-0000-0000-0000-000000000106',
        NULL,
        '00000000-0000-0000-0000-000000000002',
        'Email Sender Pro',
        'email-sender-pro',
        'Send professional emails with templates, attachments, and tracking. Premium plugin with advanced features.',
        '2.1.0',
        'CUSTOM',
        '{"input":{"type":"object","properties":{"to":{"type":"string","description":"Recipient email"},"subject":{"type":"string"},"body":{"type":"string"},"template":{"type":"string","description":"Template name"},"attachments":{"type":"array"}},"required":["to","subject"]},"output":{"type":"object","properties":{"messageId":{"type":"string"},"status":{"type":"string"}}}}',
        TRUE,
        999,
        4.9,
        50,
        'PUBLISHED'
    );
