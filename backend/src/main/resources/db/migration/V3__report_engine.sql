-- =============================================
-- DataLens BI — Phase 5: Report Engine
-- =============================================
-- V1 already created: dl_report, dl_dashboard, dl_dashboard_widget, dl_report_query
-- V2 already created: dl_query_version, dl_schema_cache, dl_query_execution, dl_query_folder
-- This migration ALTERS existing tables and CREATES new ones.

-- ══════════════════════════════════════════════
--  ALTER dl_report — add Phase 5 columns
-- ══════════════════════════════════════════════

ALTER TABLE dl_report
    ADD COLUMN IF NOT EXISTS report_type     VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS layout          JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS settings        JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN IF NOT EXISTS is_template     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS thumbnail_url   VARCHAR(500),
    ADD COLUMN IF NOT EXISTS folder_id       BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by      BIGINT REFERENCES dl_user(id);

CREATE INDEX IF NOT EXISTS idx_report_status ON dl_report(status);
CREATE INDEX IF NOT EXISTS idx_report_template ON dl_report(is_template) WHERE is_template = TRUE;
CREATE INDEX IF NOT EXISTS idx_report_folder ON dl_report(folder_id);

-- ══════════════════════════════════════════════
--  ALTER dl_dashboard — add Phase 5 columns
-- ══════════════════════════════════════════════

ALTER TABLE dl_dashboard
    ADD COLUMN IF NOT EXISTS settings        JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN IF NOT EXISTS is_public       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auto_refresh_sec INT;

-- ══════════════════════════════════════════════
--  Report Parameters
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dl_report_parameter (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    label           VARCHAR(200),
    param_type      VARCHAR(30) NOT NULL,           -- STRING, NUMBER, DATE, DATE_RANGE, SELECT, MULTI_SELECT, BOOLEAN
    default_value   VARCHAR(500),
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    config          JSONB NOT NULL DEFAULT '{}',    -- options list, min/max, format, etc.
    UNIQUE (report_id, name)
);

CREATE INDEX IF NOT EXISTS idx_report_param_report ON dl_report_parameter(report_id);

-- ══════════════════════════════════════════════
--  Report Widgets
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dl_report_widget (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    widget_type     VARCHAR(30) NOT NULL,           -- CHART, TABLE, KPI, TEXT, FILTER, IMAGE
    title           VARCHAR(300),
    query_id        BIGINT REFERENCES dl_query(id) ON DELETE SET NULL,
    datasource_id   BIGINT REFERENCES dl_datasource(id) ON DELETE SET NULL,
    raw_sql         TEXT,
    chart_config    JSONB NOT NULL DEFAULT '{}',    -- ECharts / chart configuration
    position        JSONB NOT NULL DEFAULT '{}',    -- {x, y, w, h} grid coordinates
    style           JSONB NOT NULL DEFAULT '{}',    -- visual styling overrides
    param_mapping   JSONB NOT NULL DEFAULT '{}',    -- maps report params → query params
    sort_order      INT NOT NULL DEFAULT 0,
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_widget_report ON dl_report_widget(report_id);
CREATE INDEX IF NOT EXISTS idx_report_widget_query ON dl_report_widget(query_id);

-- ══════════════════════════════════════════════
--  Dashboard ↔ Report junction
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dl_dashboard_report (
    id              BIGSERIAL PRIMARY KEY,
    dashboard_id    BIGINT NOT NULL REFERENCES dl_dashboard(id) ON DELETE CASCADE,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    position        JSONB NOT NULL DEFAULT '{}',
    sort_order      INT NOT NULL DEFAULT 0,
    UNIQUE (dashboard_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_dash_report_dash ON dl_dashboard_report(dashboard_id);

-- ══════════════════════════════════════════════
--  Report Schedules
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dl_report_schedule (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    parameters      JSONB NOT NULL DEFAULT '{}',
    output_format   VARCHAR(20) NOT NULL DEFAULT 'JSON',  -- JSON, PDF, CSV, EXCEL
    recipients      JSONB NOT NULL DEFAULT '[]',          -- [{email, name}]
    last_run_at     TIMESTAMP WITH TIME ZONE,
    last_status     VARCHAR(20),                          -- SUCCESS, ERROR
    last_error      TEXT,
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_report ON dl_report_schedule(report_id);
CREATE INDEX IF NOT EXISTS idx_schedule_active ON dl_report_schedule(is_active) WHERE is_active = TRUE;

-- ══════════════════════════════════════════════
--  Report Snapshots
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dl_report_snapshot (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    schedule_id     BIGINT REFERENCES dl_report_schedule(id) ON DELETE SET NULL,
    parameters      JSONB NOT NULL DEFAULT '{}',
    result_data     JSONB NOT NULL DEFAULT '{}',
    output_format   VARCHAR(20) NOT NULL DEFAULT 'JSON',
    file_path       VARCHAR(500),
    status          VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    execution_ms    BIGINT,
    error_message   TEXT,
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshot_report ON dl_report_snapshot(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshot_schedule ON dl_report_snapshot(schedule_id);

-- ══════════════════════════════════════════════
--  Permissions
-- ══════════════════════════════════════════════

INSERT INTO dl_permission (code, description) VALUES
    ('REPORT_EDIT',       'Edit reports'),
    ('REPORT_PUBLISH',    'Publish reports'),
    ('DASHBOARD_EDIT',    'Edit dashboards'),
    ('SCHEDULE_MANAGE',   'Manage report schedules')
ON CONFLICT (code) DO NOTHING;

-- ADMIN gets all new permissions
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'ADMIN'
  AND p.code IN ('REPORT_EDIT', 'REPORT_PUBLISH', 'DASHBOARD_EDIT', 'SCHEDULE_MANAGE')
ON CONFLICT DO NOTHING;

-- EDITOR gets edit permissions (not publish or schedule)
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'EDITOR'
  AND p.code IN ('REPORT_EDIT', 'DASHBOARD_EDIT')
ON CONFLICT DO NOTHING;
