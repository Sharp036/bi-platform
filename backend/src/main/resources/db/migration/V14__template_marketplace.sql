-- =============================================
-- Phase 22 — Dashboard Templates & Marketplace
-- =============================================

ALTER TABLE dl_report
    ADD COLUMN IF NOT EXISTS template_category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS template_preview  TEXT;

CREATE INDEX IF NOT EXISTS idx_report_template_category
    ON dl_report(template_category) WHERE is_template = TRUE;
