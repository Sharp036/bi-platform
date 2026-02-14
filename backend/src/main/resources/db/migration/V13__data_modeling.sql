-- =============================================
-- Phase 21 — Data Modeling Layer
-- Semantic layer: dimensions, measures, relationships, auto-JOIN
-- =============================================

-- ── Data Model (top-level container) ──
CREATE TABLE dl_data_model (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    description     TEXT,
    datasource_id   BIGINT NOT NULL REFERENCES dl_datasource(id) ON DELETE CASCADE,
    owner_id        BIGINT NOT NULL REFERENCES dl_user(id),
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_datasource ON dl_data_model(datasource_id);
CREATE INDEX idx_model_owner ON dl_data_model(owner_id);

-- ── Model Table (table/view registered in a model) ──
CREATE TABLE dl_model_table (
    id              BIGSERIAL PRIMARY KEY,
    model_id        BIGINT NOT NULL REFERENCES dl_data_model(id) ON DELETE CASCADE,
    table_schema    VARCHAR(200),
    table_name      VARCHAR(200) NOT NULL,
    alias           VARCHAR(100) NOT NULL,
    label           VARCHAR(300),
    description     TEXT,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    sql_expression  TEXT,              -- for derived/virtual tables (subquery)
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_table_model ON dl_model_table(model_id);

-- ── Model Field (dimension or measure) ──
CREATE TABLE dl_model_field (
    id              BIGSERIAL PRIMARY KEY,
    model_table_id  BIGINT NOT NULL REFERENCES dl_model_table(id) ON DELETE CASCADE,
    column_name     VARCHAR(200),
    field_role      VARCHAR(20) NOT NULL DEFAULT 'DIMENSION',
    -- DIMENSION, MEASURE, TIME_DIMENSION
    label           VARCHAR(300) NOT NULL,
    description     TEXT,
    data_type       VARCHAR(50),                -- string, number, date, boolean, timestamp
    aggregation     VARCHAR(30),                -- SUM, AVG, COUNT, COUNT_DISTINCT, MIN, MAX, NONE
    expression      VARCHAR(1000),              -- custom SQL expression override
    format          VARCHAR(100),               -- number, percent, currency, date format
    hidden          BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INT NOT NULL DEFAULT 0,
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_field_table ON dl_model_field(model_table_id);
CREATE INDEX idx_model_field_role ON dl_model_field(field_role);

-- ── Model Relationship (JOIN between tables) ──
CREATE TABLE dl_model_relationship (
    id                  BIGSERIAL PRIMARY KEY,
    model_id            BIGINT NOT NULL REFERENCES dl_data_model(id) ON DELETE CASCADE,
    left_table_id       BIGINT NOT NULL REFERENCES dl_model_table(id) ON DELETE CASCADE,
    left_column         VARCHAR(200) NOT NULL,
    right_table_id      BIGINT NOT NULL REFERENCES dl_model_table(id) ON DELETE CASCADE,
    right_column        VARCHAR(200) NOT NULL,
    join_type           VARCHAR(20) NOT NULL DEFAULT 'LEFT',
    -- INNER, LEFT, RIGHT, FULL
    label               VARCHAR(300),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_relationship_model ON dl_model_relationship(model_id);
CREATE INDEX idx_relationship_left ON dl_model_relationship(left_table_id);
CREATE INDEX idx_relationship_right ON dl_model_relationship(right_table_id);
