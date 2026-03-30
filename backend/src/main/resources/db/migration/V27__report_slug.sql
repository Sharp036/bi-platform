-- Add UUID slug for shareable report URLs
ALTER TABLE dl_report ADD COLUMN slug VARCHAR(36);

-- Generate UUID slugs for existing reports
UPDATE dl_report SET slug = gen_random_uuid()::text WHERE slug IS NULL;

-- Make slug non-null and unique
ALTER TABLE dl_report ALTER COLUMN slug SET NOT NULL;
ALTER TABLE dl_report ADD CONSTRAINT uq_report_slug UNIQUE (slug);
CREATE INDEX idx_report_slug ON dl_report (slug);
