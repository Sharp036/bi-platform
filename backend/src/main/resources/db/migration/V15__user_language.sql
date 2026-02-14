-- =============================================
-- Phase 24 – Internationalization: User Language Preference
-- =============================================

ALTER TABLE dl_user
    ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';

COMMENT ON COLUMN dl_user.language IS 'BCP-47 language code for UI preference';
