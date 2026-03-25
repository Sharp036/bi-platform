-- V20: add const_value to import_source_mapping for constant/derived columns.
-- When const_value is not NULL, the source_column is ignored and this value
-- is used instead. Supports two special tokens:
--   {filename}  -- replaced with the uploaded file name at import time
--   {today}     -- replaced with the current date (yyyy-MM-dd) at import time

ALTER TABLE import_source_mapping
    ADD COLUMN const_value VARCHAR(500);

-- Relax source_column NOT NULL constraint so constant-only rows can omit it
ALTER TABLE import_source_mapping
    ALTER COLUMN source_column DROP NOT NULL;

-- At least one of source_column or const_value must be present
ALTER TABLE import_source_mapping
    ADD CONSTRAINT mapping_source_or_const
        CHECK (source_column IS NOT NULL OR const_value IS NOT NULL);
