ALTER TABLE import_source
    ADD COLUMN strict_columns   BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN forbidden_columns TEXT[]   NULL;
