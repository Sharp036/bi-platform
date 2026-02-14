-- =============================================
-- Phase 19 — Annotations, Tooltips, Containers
-- =============================================

-- ── Chart Annotations (reference lines, bands, text marks) ──
CREATE TABLE dl_chart_annotation (
    id              BIGSERIAL PRIMARY KEY,
    widget_id       BIGINT NOT NULL REFERENCES dl_report_widget(id) ON DELETE CASCADE,
    annotation_type VARCHAR(30) NOT NULL DEFAULT 'LINE',
    -- LINE, BAND, TEXT, TREND
    axis            VARCHAR(10) NOT NULL DEFAULT 'y',
    -- x, y
    value           DOUBLE PRECISION,
    value_end       DOUBLE PRECISION,               -- for BAND: second boundary
    label           VARCHAR(300),
    color           VARCHAR(30) DEFAULT '#ef4444',
    line_style      VARCHAR(20) DEFAULT 'solid',    -- solid, dashed, dotted
    line_width      DOUBLE PRECISION DEFAULT 1.5,
    opacity         DOUBLE PRECISION DEFAULT 0.8,
    fill_color      VARCHAR(30),                    -- for BAND fill
    fill_opacity    DOUBLE PRECISION DEFAULT 0.1,
    position        VARCHAR(20) DEFAULT 'end',      -- start, middle, end (label position)
    font_size       INT DEFAULT 12,
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_annotation_widget ON dl_chart_annotation(widget_id);

-- ── Tooltip Configuration (rich tooltips per widget) ──
CREATE TABLE dl_tooltip_config (
    id              BIGSERIAL PRIMARY KEY,
    widget_id       BIGINT NOT NULL REFERENCES dl_report_widget(id) ON DELETE CASCADE,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    show_title      BOOLEAN NOT NULL DEFAULT TRUE,
    title_field     VARCHAR(200),
    fields          JSONB NOT NULL DEFAULT '[]',
    -- array of {field, label, format, color}
    show_sparkline  BOOLEAN NOT NULL DEFAULT FALSE,
    sparkline_field VARCHAR(200),
    html_template   VARCHAR(2000),                  -- custom HTML override
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(widget_id)
);

CREATE INDEX idx_tooltip_widget ON dl_tooltip_config(widget_id);

-- ── Widget Container Config (tab/accordion grouping) ──
CREATE TABLE dl_widget_container (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    container_type  VARCHAR(30) NOT NULL DEFAULT 'TABS',
    -- TABS, ACCORDION, HORIZONTAL, VERTICAL
    name            VARCHAR(300),
    child_widget_ids TEXT NOT NULL,                  -- comma-separated widget IDs
    active_tab      INT NOT NULL DEFAULT 0,
    auto_distribute BOOLEAN NOT NULL DEFAULT TRUE,
    config          JSONB NOT NULL DEFAULT '{}',
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_container_report ON dl_widget_container(report_id);
