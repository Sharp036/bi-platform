-- ═══════════════════════════════════════════════
--  V6 — Export & Distribution
-- ═══════════════════════════════════════════════

-- Embed tokens for iframe embedding
CREATE TABLE dl_embed_token (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    token           VARCHAR(128) NOT NULL UNIQUE,
    label           VARCHAR(300),
    parameters      JSONB NOT NULL DEFAULT '{}',
    -- Fixed parameters baked into the embed
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_domains TEXT,
    -- Comma-separated allowed origins for CORS, e.g. "https://app.example.com"
    created_by      BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_embed_token ON dl_embed_token(token);
CREATE INDEX idx_embed_report ON dl_embed_token(report_id);

