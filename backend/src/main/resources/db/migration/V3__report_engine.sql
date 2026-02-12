-- =============================================
-- DataLens BI — Phase 5: Report Engine
-- =============================================

-- ── Report definition ──
-- A report is a JSON-based layout definition that binds
-- widgets (charts, tables, KPI cards) to saved queries.
CREATE TABLE dl_report (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    report_type     VARCHAR(30) NOT NULL DEFAULT 'STANDARD',  -- STANDARD, TEMPLATE, SCHEDULED
    layout          JSONB NOT NULL DEFAULT '{}',               -- grid layout definition
    settings        JSONB NOT NULL DEFAULT '{}',               -- theme, refresh interval, etc.
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',      -- DRAFT, PUBLISHED, ARCHIVED
    is_template     BOOLEAN NOT NULL DEFAULT FALSE,
    thumbnail_url   VARCHAR(500),
    folder_id       BIGINT REFERENCES dl_query_folder(id) ON DELETE SET NULL,
    created_by      BIGINT REFERENCES dl_user(id),
    updated_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_status ON dl_report(status);
CREATE INDEX idx_report_created_by ON dl_report(created_by);

-- ── Report parameters ──
-- Parameters that the user fills in before viewing the report
-- (date range, region filter, product category, etc.)
CREATE TABLE dl_report_parameter (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    label           VARCHAR(200),
    param_type      VARCHAR(30) NOT NULL,        -- STRING, NUMBER, DATE, DATE_RANGE, SELECT, MULTI_SELECT, BOOLEAN
    default_value   VARCHAR(500),
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    config          JSONB NOT NULL DEFAULT '{}',  -- {options, datasourceId, query, min, max, format}
    UNIQUE (report_id, name)
);

CREATE INDEX idx_report_param_report ON dl_report_parameter(report_id);

-- ── Report widgets ──
-- Each widget is a chart, table, KPI card, text block, etc.
-- bound to a specific query and positioned on the report grid.
CREATE TABLE dl_report_widget (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    widget_type     VARCHAR(30) NOT NULL,         -- CHART, TABLE, KPI, TEXT, FILTER, IMAGE
    title           VARCHAR(300),
    query_id        BIGINT REFERENCES dl_query(id) ON DELETE SET NULL,
    datasource_id   BIGINT REFERENCES dl_datasource(id) ON DELETE SET NULL,
    raw_sql         TEXT,                          -- inline SQL (alternative to query_id)
    chart_config    JSONB NOT NULL DEFAULT '{}',   -- ECharts option or table/KPI config
    position        JSONB NOT NULL DEFAULT '{}',   -- {x, y, w, h} grid coordinates
    style           JSONB NOT NULL DEFAULT '{}',   -- CSS overrides, background, border
    param_mapping   JSONB NOT NULL DEFAULT '{}',   -- {widgetParam: reportParam} mapping
    sort_order      INT NOT NULL DEFAULT 0,
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_report ON dl_report_widget(report_id);
CREATE INDEX idx_widget_query ON dl_report_widget(query_id);

-- ── Dashboard (enhanced) ──
-- If dl_dashboard already exists from V1, alter it; otherwise create.
-- A dashboard is a collection of reports/widgets with its own layout.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'dl_dashboard' AND column_name = 'settings') THEN
        ALTER TABLE dl_dashboard
            ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS auto_refresh_sec INT,
            ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES dl_user(id);
    END IF;
END $$;

-- ── Dashboard ↔ Report junction ──
CREATE TABLE IF NOT EXISTS dl_dashboard_report (
    id              BIGSERIAL PRIMARY KEY,
    dashboard_id    BIGINT NOT NULL REFERENCES dl_dashboard(id) ON DELETE CASCADE,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    position        JSONB NOT NULL DEFAULT '{}',   -- {x, y, w, h}
    sort_order      INT NOT NULL DEFAULT 0,
    UNIQUE (dashboard_id, report_id)
);

-- ── Report scheduling ──
CREATE TABLE dl_report_schedule (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,          -- e.g. "0 8 * * 1" = every Monday 8am
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    parameters      JSONB NOT NULL DEFAULT '{}',    -- fixed params for scheduled run
    output_format   VARCHAR(20) NOT NULL DEFAULT 'JSON',  -- JSON, PDF, CSV, EXCEL
    recipients      JSONB NOT NULL DEFAULT '[]',    -- [{email, userId}]
    last_run_at     TIMESTAMP WITH TIME ZONE,
    last_status     VARCHAR(20),                    -- SUCCESS, ERROR
    last_error      TEXT,
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedule_report ON dl_report_schedule(report_id);
CREATE INDEX idx_schedule_active ON dl_report_schedule(is_active) WHERE is_active = TRUE;

-- ── Report snapshot ──
-- Point-in-time cached render of a report (data + metadata).
CREATE TABLE dl_report_snapshot (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    schedule_id     BIGINT REFERENCES dl_report_schedule(id) ON DELETE SET NULL,
    parameters      JSONB NOT NULL DEFAULT '{}',
    result_data     JSONB NOT NULL DEFAULT '{}',    -- rendered widget data
    output_format   VARCHAR(20) NOT NULL DEFAULT 'JSON',
    file_path       VARCHAR(500),                   -- path to exported file (PDF/Excel)
    status          VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    execution_ms    BIGINT,
    error_message   TEXT,
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshot_report ON dl_report_snapshot(report_id, created_at DESC);

-- ── Permissions ──
INSERT INTO dl_permission (code, description)
VALUES
    ('REPORT_VIEW', 'View reports'),
    ('REPORT_EDIT', 'Create and edit reports'),
    ('REPORT_PUBLISH', 'Publish and share reports'),
    ('DASHBOARD_VIEW', 'View dashboards'),
    ('DASHBOARD_EDIT', 'Create and edit dashboards'),
    ('SCHEDULE_MANAGE', 'Manage report schedules')
ON CONFLICT (code) DO NOTHING;

-- Grant to roles
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'ADMIN' AND p.code IN ('REPORT_VIEW','REPORT_EDIT','REPORT_PUBLISH','DASHBOARD_VIEW','DASHBOARD_EDIT','SCHEDULE_MANAGE')
ON CONFLICT DO NOTHING;

INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'EDITOR' AND p.code IN ('REPORT_VIEW','REPORT_EDIT','DASHBOARD_VIEW','DASHBOARD_EDIT')
ON CONFLICT DO NOTHING;

INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'VIEWER' AND p.code IN ('REPORT_VIEW','DASHBOARD_VIEW')
ON CONFLICT DO NOTHING;
