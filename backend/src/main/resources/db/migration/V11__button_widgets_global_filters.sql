-- =============================================
-- Phase 18 — Button Widgets, Parameter Controls, Global Filters
-- =============================================

-- ── Global Filter Configuration ──
-- Which widgets participate in cross-filtering and which are excluded
CREATE TABLE dl_global_filter_config (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    widget_id       BIGINT NOT NULL REFERENCES dl_report_widget(id) ON DELETE CASCADE,
    is_filter_source BOOLEAN NOT NULL DEFAULT FALSE,   -- widget acts as a filter source
    filter_field    VARCHAR(200),                       -- which field to filter on
    excluded_targets TEXT,                              -- comma-separated widget IDs to exclude
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(report_id, widget_id)
);

CREATE INDEX idx_global_filter_report ON dl_global_filter_config(report_id);

-- ── Parameter Control Config ──
-- Extended parameter UI settings (slider range, cascading, data-driven options)
CREATE TABLE dl_parameter_control (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    parameter_name  VARCHAR(100) NOT NULL,
    control_type    VARCHAR(30) NOT NULL DEFAULT 'INPUT',
    -- INPUT, DROPDOWN, SLIDER, RADIO, DATE_PICKER, MULTI_CHECKBOX
    datasource_id   BIGINT,
    options_query   TEXT,                               -- SQL to load options dynamically
    cascade_parent  VARCHAR(100),                       -- parent parameter name for cascading
    cascade_field   VARCHAR(200),                       -- field to filter by parent value
    slider_min      DOUBLE PRECISION,
    slider_max      DOUBLE PRECISION,
    slider_step     DOUBLE PRECISION DEFAULT 1,
    config          JSONB NOT NULL DEFAULT '{}',
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(report_id, parameter_name)
);

CREATE INDEX idx_param_control_report ON dl_parameter_control(report_id);
