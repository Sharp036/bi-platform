-- ── V18: IMPORTER role, filename_pattern/file_encoding columns, add tsv/json formats ──

-- New columns on import_source
ALTER TABLE import_source
    ADD COLUMN filename_pattern VARCHAR(255),
    ADD COLUMN file_encoding    VARCHAR(20) NOT NULL DEFAULT 'UTF-8';

-- Extend allowed formats (drop & re-create the CHECK constraint)
ALTER TABLE import_source DROP CONSTRAINT IF EXISTS import_source_source_format_check;
ALTER TABLE import_source
    ADD CONSTRAINT import_source_source_format_check
        CHECK (source_format IN ('xlsx', 'csv', 'tsv', 'json', 'zip'));

-- New system role: IMPORTER
INSERT INTO dl_role (name, description, is_system) VALUES
    ('IMPORTER', 'Can upload files for data import', TRUE);

-- IMPORTER gets IMPORT_UPLOAD + REPORT_VIEW
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'IMPORTER'
  AND p.code IN ('IMPORT_UPLOAD', 'REPORT_VIEW');
