-- ── Data Import Feature ──────────────────────────────────────────────────────

CREATE TABLE import_source (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    datasource_id   BIGINT NOT NULL REFERENCES dl_datasource(id),
    source_format   VARCHAR(10)  NOT NULL CHECK (source_format IN ('xlsx', 'csv', 'zip')),
    sheet_name      VARCHAR(255),
    header_row      INT NOT NULL DEFAULT 1,
    skip_rows       INT NOT NULL DEFAULT 0,
    target_schema   VARCHAR(255) NOT NULL,
    target_table    VARCHAR(255) NOT NULL,
    load_mode       VARCHAR(10)  NOT NULL DEFAULT 'append'
                        CHECK (load_mode IN ('append', 'replace', 'upsert')),
    key_columns     TEXT[],
    created_by      BIGINT REFERENCES dl_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_source_mapping (
    id              BIGSERIAL PRIMARY KEY,
    source_id       BIGINT NOT NULL REFERENCES import_source(id) ON DELETE CASCADE,
    source_column   VARCHAR(255) NOT NULL,
    target_column   VARCHAR(255) NOT NULL,
    data_type       VARCHAR(20)  NOT NULL
                        CHECK (data_type IN ('string', 'integer', 'float', 'date', 'datetime', 'boolean')),
    nullable        BOOLEAN NOT NULL DEFAULT TRUE,
    date_format     VARCHAR(50)
);

CREATE TABLE import_log (
    id              BIGSERIAL PRIMARY KEY,
    source_id       BIGINT NOT NULL REFERENCES import_source(id),
    filename        VARCHAR(255) NOT NULL,
    uploaded_by     BIGINT REFERENCES dl_user(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rows_total      INT,
    rows_imported   INT,
    rows_failed     INT,
    status          VARCHAR(15) NOT NULL DEFAULT 'validating'
                        CHECK (status IN ('validating', 'valid', 'importing', 'success', 'error')),
    error_detail    TEXT
);

CREATE TABLE import_log_error (
    id              BIGSERIAL PRIMARY KEY,
    log_id          BIGINT NOT NULL REFERENCES import_log(id) ON DELETE CASCADE,
    row_number      INT NOT NULL,
    column_name     VARCHAR(255),
    error_message   TEXT NOT NULL
);

CREATE INDEX ON import_log(source_id);
CREATE INDEX ON import_log(uploaded_at DESC);
CREATE INDEX ON import_log_error(log_id);

-- ── Permissions ───────────────────────────────────────────────────────────────

INSERT INTO dl_permission (code, description) VALUES
    ('IMPORT_MANAGE', 'Manage data import source configurations'),
    ('IMPORT_UPLOAD', 'Upload files for data import');

-- ADMIN gets both
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'ADMIN' AND p.code IN ('IMPORT_MANAGE', 'IMPORT_UPLOAD');

-- EDITOR gets IMPORT_UPLOAD
INSERT INTO dl_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM dl_role r, dl_permission p
WHERE r.name = 'EDITOR' AND p.code = 'IMPORT_UPLOAD';
