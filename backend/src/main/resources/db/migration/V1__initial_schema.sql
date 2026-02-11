-- =============================================
-- DataLens BI — Initial Schema
-- =============================================

-- ── Users ──
CREATE TABLE dl_user (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(200),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Roles ──
CREATE TABLE dl_role (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE,  -- system roles can't be deleted
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── User ↔ Role (many-to-many) ──
CREATE TABLE dl_user_role (
    user_id BIGINT NOT NULL REFERENCES dl_user(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES dl_role(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ── Permissions ──
CREATE TABLE dl_permission (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(100) NOT NULL UNIQUE,   -- e.g. 'DATASOURCE_CREATE', 'REPORT_VIEW'
    description TEXT
);

-- ── Role ↔ Permission (many-to-many) ──
CREATE TABLE dl_role_permission (
    role_id       BIGINT NOT NULL REFERENCES dl_role(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES dl_permission(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ── Data Sources ──
CREATE TABLE dl_datasource (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    type            VARCHAR(50) NOT NULL,          -- POSTGRESQL, CLICKHOUSE
    host            VARCHAR(255) NOT NULL,
    port            INTEGER NOT NULL,
    database_name   VARCHAR(200) NOT NULL,
    username        VARCHAR(200),
    password_enc    VARCHAR(500),                   -- encrypted
    extra_params    JSONB DEFAULT '{}',             -- additional JDBC params
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Saved Queries ──
CREATE TABLE dl_query (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    datasource_id   BIGINT NOT NULL REFERENCES dl_datasource(id),
    sql_text        TEXT NOT NULL,
    parameters      JSONB DEFAULT '[]',             -- [{name, type, defaultValue}]
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Reports ──
CREATE TABLE dl_report (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    folder_path     VARCHAR(500) DEFAULT '/',       -- virtual folder hierarchy
    definition      JSONB NOT NULL DEFAULT '{}',    -- full report layout & components
    parameters      JSONB DEFAULT '[]',             -- report-level parameters
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Report ↔ Query (many-to-many: a report can use multiple queries) ──
CREATE TABLE dl_report_query (
    report_id BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    query_id  BIGINT NOT NULL REFERENCES dl_query(id) ON DELETE CASCADE,
    alias     VARCHAR(100) NOT NULL,               -- alias used in report definition
    PRIMARY KEY (report_id, query_id)
);

-- ── Dashboards ──
CREATE TABLE dl_dashboard (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    layout          JSONB NOT NULL DEFAULT '{}',    -- grid layout definition
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Dashboard ↔ Report (widgets on dashboard) ──
CREATE TABLE dl_dashboard_widget (
    id              BIGSERIAL PRIMARY KEY,
    dashboard_id    BIGINT NOT NULL REFERENCES dl_dashboard(id) ON DELETE CASCADE,
    report_id       BIGINT REFERENCES dl_report(id) ON DELETE SET NULL,
    widget_type     VARCHAR(50) NOT NULL,           -- CHART, TABLE, KPI, TEXT, FILTER
    config          JSONB NOT NULL DEFAULT '{}',    -- widget-specific settings
    position        JSONB NOT NULL DEFAULT '{}',    -- {x, y, w, h}
    scripts         JSONB DEFAULT '{}',             -- JS hooks: {onClick, onRender, ...}
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Object-Level Access Control ──
CREATE TABLE dl_object_permission (
    id              BIGSERIAL PRIMARY KEY,
    object_type     VARCHAR(50) NOT NULL,           -- DATASOURCE, REPORT, DASHBOARD
    object_id       BIGINT NOT NULL,
    role_id         BIGINT REFERENCES dl_role(id) ON DELETE CASCADE,
    user_id         BIGINT REFERENCES dl_user(id) ON DELETE CASCADE,
    access_level    VARCHAR(20) NOT NULL DEFAULT 'VIEW',  -- VIEW, EDIT, ADMIN
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_role_or_user CHECK (
        (role_id IS NOT NULL AND user_id IS NULL) OR
        (role_id IS NULL AND user_id IS NOT NULL)
    )
);

CREATE INDEX idx_object_perm_lookup
    ON dl_object_permission(object_type, object_id);

-- ── Audit Log ──
CREATE TABLE dl_audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES dl_user(id),
    action      VARCHAR(100) NOT NULL,              -- LOGIN, QUERY_EXECUTE, REPORT_VIEW, etc.
    object_type VARCHAR(50),
    object_id   BIGINT,
    details     JSONB DEFAULT '{}',
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON dl_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON dl_audit_log(action, created_at DESC);

-- ── Seed: System Roles ──
INSERT INTO dl_role (name, description, is_system) VALUES
    ('ADMIN',  'Full system access', TRUE),
    ('EDITOR', 'Can create and edit reports and datasources', TRUE),
    ('VIEWER', 'Can view published reports and dashboards', TRUE);

-- ── Seed: Core Permissions ──
INSERT INTO dl_permission (code, description) VALUES
    ('SYSTEM_ADMIN',      'Full system administration'),
    ('DATASOURCE_CREATE',  'Create data sources'),
    ('DATASOURCE_EDIT',    'Edit data sources'),
    ('DATASOURCE_DELETE',  'Delete data sources'),
    ('DATASOURCE_VIEW',    'View data sources'),
    ('QUERY_EXECUTE',      'Execute queries'),
    ('QUERY_CREATE',       'Create saved queries'),
    ('REPORT_CREATE',      'Create reports'),
    ('REPORT_EDIT',        'Edit reports'),
    ('REPORT_DELETE',      'Delete reports'),
    ('REPORT_VIEW',        'View reports'),
    ('DASHBOARD_CREATE',   'Create dashboards'),
    ('DASHBOARD_EDIT',     'Edit dashboards'),
    ('DASHBOARD_DELETE',   'Delete dashboards'),
    ('DASHBOARD_VIEW',     'View dashboards'),
    ('USER_MANAGE',        'Manage users and roles');

-- ── Seed: Admin gets all permissions ──
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p WHERE r.name = 'ADMIN';

-- ── Seed: Editor permissions ──
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'EDITOR'
  AND p.code IN (
    'DATASOURCE_VIEW', 'QUERY_EXECUTE', 'QUERY_CREATE',
    'REPORT_CREATE', 'REPORT_EDIT', 'REPORT_VIEW',
    'DASHBOARD_CREATE', 'DASHBOARD_EDIT', 'DASHBOARD_VIEW'
  );

-- ── Seed: Viewer permissions ──
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'VIEWER'
  AND p.code IN ('DATASOURCE_VIEW', 'REPORT_VIEW', 'DASHBOARD_VIEW');
