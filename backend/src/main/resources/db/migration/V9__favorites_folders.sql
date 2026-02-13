-- =============================================
-- Phase 16 — Favorites, Recent Items & Folders
-- =============================================

-- ── User Favorites (star any object) ──
CREATE TABLE dl_favorite (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES dl_user(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL,       -- REPORT, DASHBOARD, DATASOURCE, QUERY
    object_id   BIGINT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, object_type, object_id)
);

CREATE INDEX idx_favorite_user ON dl_favorite(user_id, object_type);

-- ── Recent Items (track user activity) ──
CREATE TABLE dl_recent_item (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES dl_user(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL,
    object_id   BIGINT NOT NULL,
    viewed_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    view_count  INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, object_type, object_id)
);

CREATE INDEX idx_recent_user ON dl_recent_item(user_id, viewed_at DESC);

-- ── Folders (tree structure) ──
CREATE TABLE dl_folder (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    parent_id   BIGINT REFERENCES dl_folder(id) ON DELETE CASCADE,
    owner_id    BIGINT NOT NULL REFERENCES dl_user(id),
    is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
    icon        VARCHAR(50),
    color       VARCHAR(20),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_folder_parent ON dl_folder(parent_id);
CREATE INDEX idx_folder_owner ON dl_folder(owner_id);

-- ── Folder ↔ Object mapping ──
CREATE TABLE dl_folder_item (
    id          BIGSERIAL PRIMARY KEY,
    folder_id   BIGINT NOT NULL REFERENCES dl_folder(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL,
    object_id   BIGINT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    added_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(folder_id, object_type, object_id)
);

CREATE INDEX idx_folder_item_folder ON dl_folder_item(folder_id);
