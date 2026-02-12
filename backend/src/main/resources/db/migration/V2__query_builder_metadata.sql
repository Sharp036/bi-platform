-- =============================================
-- DataLens BI — Phase 4: Query Builder & Metadata
-- =============================================

-- ── Saved Query Versioning ──
-- Each edit of a saved query creates a new version.
-- dl_query.current_version points to the active version.
CREATE TABLE dl_query_version (
    id              BIGSERIAL PRIMARY KEY,
    query_id        BIGINT NOT NULL REFERENCES dl_query(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    sql_text        TEXT,                            -- raw SQL (if mode = RAW)
    visual_query    JSONB,                           -- visual query model (if mode = VISUAL)
    compiled_sql    TEXT,                             -- auto-compiled from visual_query
    query_mode      VARCHAR(20) NOT NULL DEFAULT 'RAW',  -- RAW or VISUAL
    change_note     TEXT,
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (query_id, version_number)
);

CREATE INDEX idx_query_version_query ON dl_query_version(query_id, version_number DESC);

-- Add versioning columns to dl_query
ALTER TABLE dl_query
    ADD COLUMN IF NOT EXISTS current_version_id BIGINT REFERENCES dl_query_version(id),
    ADD COLUMN IF NOT EXISTS query_mode VARCHAR(20) NOT NULL DEFAULT 'RAW',
    ADD COLUMN IF NOT EXISTS visual_query JSONB,
    ADD COLUMN IF NOT EXISTS compiled_sql TEXT,
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS execution_count BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_execution_ms BIGINT,
    ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP WITH TIME ZONE;

-- ── Schema Metadata Cache ──
-- Cached schema introspection results to avoid repeated JDBC metadata calls.
CREATE TABLE dl_schema_cache (
    id              BIGSERIAL PRIMARY KEY,
    datasource_id   BIGINT NOT NULL REFERENCES dl_datasource(id) ON DELETE CASCADE,
    schema_name     VARCHAR(200),
    table_name      VARCHAR(200) NOT NULL,
    table_type      VARCHAR(50),                     -- TABLE, VIEW, MATERIALIZED VIEW
    columns_json    JSONB NOT NULL DEFAULT '[]',     -- [{name, type, nullable, isPk, comment}]
    row_count_est   BIGINT,                          -- estimated row count
    cached_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (datasource_id, schema_name, table_name)
);

CREATE INDEX idx_schema_cache_ds ON dl_schema_cache(datasource_id);

-- ── Query Execution Log ──
-- Detailed log of every query execution for analytics, debugging, auditing.
CREATE TABLE dl_query_execution (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES dl_user(id),
    datasource_id   BIGINT REFERENCES dl_datasource(id),
    saved_query_id  BIGINT REFERENCES dl_query(id),  -- NULL for ad-hoc queries
    sql_text        TEXT NOT NULL,
    parameters      JSONB DEFAULT '{}',
    status          VARCHAR(20) NOT NULL,             -- SUCCESS, ERROR, TIMEOUT, CANCELLED
    row_count       INT,
    execution_ms    BIGINT,
    error_message   TEXT,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_query_exec_user ON dl_query_execution(user_id, created_at DESC);
CREATE INDEX idx_query_exec_ds ON dl_query_execution(datasource_id, created_at DESC);
CREATE INDEX idx_query_exec_status ON dl_query_execution(status, created_at DESC);

-- ── Query Folders ──
-- Organize saved queries into folders.
CREATE TABLE dl_query_folder (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    parent_id       BIGINT REFERENCES dl_query_folder(id) ON DELETE CASCADE,
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add folder reference to dl_query
ALTER TABLE dl_query
    ADD COLUMN IF NOT EXISTS folder_id BIGINT REFERENCES dl_query_folder(id) ON DELETE SET NULL;

-- ── Add QUERY_SAVE permission ──
INSERT INTO dl_permission (code, description)
VALUES ('QUERY_SAVE', 'Save and manage queries')
ON CONFLICT (code) DO NOTHING;

-- Grant QUERY_SAVE to EDITOR and ADMIN
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name IN ('ADMIN', 'EDITOR') AND p.code = 'QUERY_SAVE'
ON CONFLICT DO NOTHING;
