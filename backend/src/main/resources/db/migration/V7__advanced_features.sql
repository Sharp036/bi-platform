-- ═══════════════════════════════════════════════
--  V7 — Advanced Features
-- ═══════════════════════════════════════════════

-- ── Calculated Fields ──
CREATE TABLE dl_calculated_field (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    label           VARCHAR(300),
    expression      TEXT NOT NULL,
    -- Expression syntax: column references + operators + functions
    -- e.g. "[revenue] - [cost]", "IF([status] = 'OK', [amount], 0)"
    -- e.g. "SUM([amount])", "COUNT(DISTINCT [customer_id])"
    result_type     VARCHAR(30) NOT NULL DEFAULT 'NUMBER',
    -- NUMBER, STRING, DATE, BOOLEAN
    format_pattern  VARCHAR(100),
    -- e.g. "#,##0.00", "0.0%", "yyyy-MM-dd"
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calc_field_report ON dl_calculated_field(report_id);

-- ── Data Alerts ──
CREATE TABLE dl_data_alert (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    widget_id       BIGINT REFERENCES dl_report_widget(id) ON DELETE SET NULL,
    -- Condition
    condition_type  VARCHAR(30) NOT NULL DEFAULT 'THRESHOLD',
    -- THRESHOLD, CHANGE_PERCENT, ANOMALY, ROW_COUNT
    field_name      VARCHAR(200) NOT NULL,
    operator        VARCHAR(20) NOT NULL DEFAULT 'GT',
    -- GT, GTE, LT, LTE, EQ, NEQ, BETWEEN
    threshold_value DOUBLE PRECISION,
    threshold_high  DOUBLE PRECISION,
    -- For BETWEEN: value BETWEEN threshold_value AND threshold_high
    -- For CHANGE_PERCENT: percent change vs previous run
    -- Notification
    notification_type VARCHAR(30) NOT NULL DEFAULT 'IN_APP',
    -- IN_APP, EMAIL, WEBHOOK
    recipients      TEXT,
    webhook_url     VARCHAR(500),
    -- State
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_checked_at TIMESTAMPTZ,
    last_triggered_at TIMESTAMPTZ,
    last_value      DOUBLE PRECISION,
    consecutive_triggers INT NOT NULL DEFAULT 0,
    check_interval_min  INT NOT NULL DEFAULT 60,
    created_by      BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_report ON dl_data_alert(report_id);
CREATE INDEX idx_alert_active ON dl_data_alert(is_active);

-- Alert history
CREATE TABLE dl_alert_event (
    id              BIGSERIAL PRIMARY KEY,
    alert_id        BIGINT NOT NULL REFERENCES dl_data_alert(id) ON DELETE CASCADE,
    event_type      VARCHAR(30) NOT NULL,
    -- TRIGGERED, RESOLVED, ERROR
    field_value     DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    message         TEXT,
    notified        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_event_alert ON dl_alert_event(alert_id);
CREATE INDEX idx_alert_event_time ON dl_alert_event(created_at);

-- ── Bookmarks (saved filter states) ──
CREATE TABLE dl_bookmark (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    parameters      JSONB NOT NULL DEFAULT '{}',
    -- Saved parameter values
    filters         JSONB NOT NULL DEFAULT '{}',
    -- Saved dashboard/widget filter states
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    is_shared       BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookmark_report ON dl_bookmark(report_id);
CREATE INDEX idx_bookmark_user ON dl_bookmark(created_by);
