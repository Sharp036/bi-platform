-- =============================================
-- Phase 17 — Tags & Global Search
-- =============================================

-- ── Tags ──
CREATE TABLE dl_tag (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    color       VARCHAR(20),
    created_by  BIGINT REFERENCES dl_user(id),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tag_name ON dl_tag(name);

-- ── Tag ↔ Object mapping ──
CREATE TABLE dl_object_tag (
    id          BIGSERIAL PRIMARY KEY,
    tag_id      BIGINT NOT NULL REFERENCES dl_tag(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL,
    object_id   BIGINT NOT NULL,
    tagged_by   BIGINT REFERENCES dl_user(id),
    tagged_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(tag_id, object_type, object_id)
);

CREATE INDEX idx_object_tag_object ON dl_object_tag(object_type, object_id);
CREATE INDEX idx_object_tag_tag ON dl_object_tag(tag_id);
