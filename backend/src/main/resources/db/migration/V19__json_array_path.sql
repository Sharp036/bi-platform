-- V19: add json_array_path to import_source (path to nested array in JSON, supports * wildcards)
ALTER TABLE import_source
    ADD COLUMN json_array_path VARCHAR(500);
