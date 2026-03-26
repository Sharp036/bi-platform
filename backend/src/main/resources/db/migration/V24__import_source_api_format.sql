-- Add 'api' as a valid source format for sources that receive data via the import API
-- (file is always XLSX under the hood, parsed the same way as 'xlsx')
ALTER TABLE import_source DROP CONSTRAINT IF EXISTS import_source_source_format_check;
ALTER TABLE import_source
    ADD CONSTRAINT import_source_source_format_check
        CHECK (source_format IN ('xlsx', 'csv', 'tsv', 'json', 'zip', 'api'));
