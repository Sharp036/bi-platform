-- ═══════════════════════════════════════════════
--  V8 — Interactive Dashboard Features
-- ═══════════════════════════════════════════════

-- ── Chart Layers ──
-- Multiple data series on one widget with independent config
CREATE TABLE dl_chart_layer (
    id              BIGSERIAL PRIMARY KEY,
    widget_id       BIGINT NOT NULL REFERENCES dl_report_widget(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    label           VARCHAR(300),
    -- Data source: either a saved query or inline SQL
    query_id        BIGINT,
    datasource_id   BIGINT,
    raw_sql         TEXT,
    -- Layer rendering
    chart_type      VARCHAR(30) NOT NULL DEFAULT 'line',
    -- bar, line, area, scatter, pie
    axis            VARCHAR(10) NOT NULL DEFAULT 'left',
    -- left, right (for dual-axis)
    color           VARCHAR(30),
    opacity         DOUBLE PRECISION DEFAULT 1.0,
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    -- Full ECharts series config override
    series_config   JSONB NOT NULL DEFAULT '{}',
    -- Field mapping
    category_field  VARCHAR(200),
    value_field     VARCHAR(200),
    param_mapping   JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chart_layer_widget ON dl_chart_layer(widget_id);

-- ── Dashboard Actions ──
-- Cross-filter, highlight, navigation between widgets
CREATE TABLE dl_dashboard_action (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    name            VARCHAR(300) NOT NULL,
    action_type     VARCHAR(30) NOT NULL DEFAULT 'FILTER',
    -- FILTER, HIGHLIGHT, NAVIGATE, URL
    trigger_type    VARCHAR(20) NOT NULL DEFAULT 'CLICK',
    -- CLICK, HOVER, SELECT
    source_widget_id BIGINT REFERENCES dl_report_widget(id) ON DELETE CASCADE,
    -- NULL = applies to all widgets
    target_widget_ids TEXT,
    -- Comma-separated widget IDs, or '*' for all, '-5,-8' to exclude
    -- For FILTER action
    source_field    VARCHAR(200),
    target_field    VARCHAR(200),
    -- For NAVIGATE action
    target_report_id BIGINT,
    -- For URL action
    url_template    VARCHAR(1000),
    -- e.g. "https://example.com/detail?id={customer_id}"
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_action_report ON dl_dashboard_action(report_id);
CREATE INDEX idx_action_source ON dl_dashboard_action(source_widget_id);

-- ── Widget Visibility Rules ──
-- Dynamic zone visibility: show/hide widgets by condition
CREATE TABLE dl_visibility_rule (
    id              BIGSERIAL PRIMARY KEY,
    widget_id       BIGINT NOT NULL REFERENCES dl_report_widget(id) ON DELETE CASCADE,
    rule_type       VARCHAR(30) NOT NULL DEFAULT 'PARAMETER',
    -- PARAMETER, FIELD_VALUE, ROLE, ALWAYS_HIDDEN
    parameter_name  VARCHAR(200),
    operator        VARCHAR(20) NOT NULL DEFAULT 'EQ',
    -- EQ, NEQ, GT, LT, IN, NOT_IN, IS_SET, IS_NOT_SET
    expected_value  VARCHAR(500),
    -- For ROLE: comma-separated role names
    -- For FIELD_VALUE: widget_id:field_name pattern
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visibility_widget ON dl_visibility_rule(widget_id);

-- ── Floating Overlays (logos, images, shapes) ──
CREATE TABLE dl_dashboard_overlay (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    overlay_type    VARCHAR(30) NOT NULL DEFAULT 'IMAGE',
    -- IMAGE, TEXT, SHAPE, DIVIDER
    content         TEXT,
    -- For IMAGE: URL; for TEXT: html; for SHAPE: svg
    position_x      INT NOT NULL DEFAULT 0,
    position_y      INT NOT NULL DEFAULT 0,
    width           INT NOT NULL DEFAULT 100,
    height          INT NOT NULL DEFAULT 50,
    -- px units for floating overlays
    opacity         DOUBLE PRECISION DEFAULT 1.0,
    z_index         INT NOT NULL DEFAULT 100,
    link_url        VARCHAR(1000),
    -- Clickable link
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    style           JSONB NOT NULL DEFAULT '{}',
    -- border, shadow, borderRadius, padding, background
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_overlay_report ON dl_dashboard_overlay(report_id);
