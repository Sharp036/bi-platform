-- ═══════════════════════════════════════════════
--  V5 — Drill-Down Reports
-- ═══════════════════════════════════════════════

-- Drill-down action: defines click → navigate behavior
CREATE TABLE dl_drill_action (
    id                  BIGSERIAL PRIMARY KEY,
    source_widget_id    BIGINT NOT NULL REFERENCES dl_report_widget(id) ON DELETE CASCADE,
    target_report_id    BIGINT NOT NULL REFERENCES dl_report(id) ON DELETE CASCADE,
    action_type         VARCHAR(30) NOT NULL DEFAULT 'DRILL_DOWN',
    -- DRILL_DOWN  = navigate to child report (push to stack)
    -- DRILL_THROUGH = open detail report (new context)
    -- CROSS_LINK = navigate to unrelated report
    label               VARCHAR(300),
    description         TEXT,
    param_mapping       JSONB NOT NULL DEFAULT '{}',
    -- Maps clicked data to target report parameters:
    -- { "targetParamName": { "source": "column", "value": "region" } }
    -- { "targetParamName": { "source": "fixed", "value": "2024" } }
    -- { "targetParamName": { "source": "series", "value": "seriesName" } }
    trigger_type        VARCHAR(30) NOT NULL DEFAULT 'ROW_CLICK',
    -- ROW_CLICK    = click on table row
    -- CHART_CLICK  = click on chart element (bar, point, slice)
    -- BUTTON       = explicit drill-down button
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INT NOT NULL DEFAULT 0,
    open_mode           VARCHAR(20) NOT NULL DEFAULT 'REPLACE',
    -- REPLACE = replace current view (with breadcrumb back)
    -- NEW_TAB = open in new browser tab
    config              JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drill_action_source ON dl_drill_action(source_widget_id);
CREATE INDEX idx_drill_action_target ON dl_drill_action(target_report_id);
CREATE INDEX idx_drill_action_active ON dl_drill_action(is_active);
