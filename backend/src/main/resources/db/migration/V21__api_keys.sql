-- V21: API keys for programmatic access (e.g. client data upload via HTTP).
-- Keys are hashed (SHA-256) — plaintext is shown once and never stored.

CREATE TABLE api_key (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255)  NOT NULL,
    key_prefix  VARCHAR(16)   NOT NULL,          -- first chars for display only
    key_hash    VARCHAR(64)   NOT NULL UNIQUE,    -- SHA-256 hex of the full key
    user_id     BIGINT        NOT NULL REFERENCES dl_user(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);
