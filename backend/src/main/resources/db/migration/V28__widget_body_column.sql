-- ═══════════════════════════════════════════════════════════════════════
-- V28: Add `body` column for widget body content (HTML for TEXT widgets).
--
-- Background. TEXT widgets historically stored their HTML body in the
-- `title` column (VARCHAR(300)). Any non-trivial markup easily exceeded 300
-- chars and saving the widget hit "value too long for type character
-- varying(300)". An interim frontend fix moved the body into
-- `chart_config -> 'content'` (JSONB). This migration finalizes the split:
-- body lives in its own dedicated column, title is uniformly the widget's
-- display name across every widget type.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE dl_report_widget
    ADD COLUMN IF NOT EXISTS body TEXT;

-- Backfill 1: legacy widgets where the HTML still sits in `title`. Detect
-- by widget_type plus a heuristic (the title contains an HTML tag). Only
-- moves the body when the destination is empty so the migration is idempotent.
UPDATE dl_report_widget
SET body  = title,
    title = ''
WHERE widget_type = 'TEXT'
  AND body IS NULL
  AND title IS NOT NULL
  AND title ~ '<[^>]+>';

-- Backfill 2: widgets that already moved through the interim chart_config
-- detour. Pull the body out of JSONB and drop the now-redundant key. The
-- companion `widgetName` key (used as a temporary display name) is promoted
-- into title when present so users do not lose the widget's name.
UPDATE dl_report_widget
SET body         = chart_config ->> 'content',
    title        = COALESCE(chart_config ->> 'widgetName', title, ''),
    chart_config = chart_config - 'content' - 'widgetName'
WHERE widget_type = 'TEXT'
  AND body IS NULL
  AND chart_config ? 'content';
