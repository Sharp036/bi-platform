-- Allow import_source deletion even when import_log records exist.
-- import_log_error already has ON DELETE CASCADE via log_id FK.

ALTER TABLE import_log
    DROP CONSTRAINT import_log_source_id_fkey,
    ADD CONSTRAINT import_log_source_id_fkey
        FOREIGN KEY (source_id) REFERENCES import_source(id) ON DELETE CASCADE;
