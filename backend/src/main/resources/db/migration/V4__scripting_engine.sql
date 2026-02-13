-- ═══════════════════════════════════════════════
--  V4 — Scripting Engine
-- ═══════════════════════════════════════════════

-- Script library: reusable JS snippets
CREATE TABLE dl_script (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    script_type     VARCHAR(30) NOT NULL DEFAULT 'TRANSFORM',
    -- TRANSFORM  = data pre/post-processing
    -- FORMAT     = conditional formatting
    -- EVENT      = chart event handler (onClick etc.)
    -- LIBRARY    = reusable helper functions
    code            TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_library      BOOLEAN NOT NULL DEFAULT FALSE,
    tags            JSONB DEFAULT '[]',
    config          JSONB DEFAULT '{}',
    created_by      BIGINT,
    updated_by      BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_script_type ON dl_script(script_type);
CREATE INDEX idx_script_active ON dl_script(is_active);
CREATE INDEX idx_script_library ON dl_script(is_library);

-- Script execution log
CREATE TABLE dl_script_execution (
    id              BIGSERIAL PRIMARY KEY,
    script_id       BIGINT REFERENCES dl_script(id) ON DELETE SET NULL,
    script_name     VARCHAR(300),
    context_type    VARCHAR(30),   -- WIDGET, REPORT, ADHOC
    context_id      BIGINT,        -- widget_id or report_id
    status          VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    execution_ms    BIGINT,
    input_rows      INT,
    output_rows     INT,
    error_message   TEXT,
    executed_by     VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_script_exec_script ON dl_script_execution(script_id);
CREATE INDEX idx_script_exec_status ON dl_script_execution(status);

-- Add script references to widgets
ALTER TABLE dl_report_widget
    ADD COLUMN transform_script_id  BIGINT REFERENCES dl_script(id) ON DELETE SET NULL,
    ADD COLUMN format_script_id     BIGINT REFERENCES dl_script(id) ON DELETE SET NULL,
    ADD COLUMN event_scripts        JSONB DEFAULT '{}';
    -- event_scripts: {"onClick": 5, "onDataLoaded": 12, "onRender": null}
