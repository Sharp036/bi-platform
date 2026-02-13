package com.datorio.model.dto

import java.time.OffsetDateTime

// ═══════════════════════════════════════════
//  Favorites
// ═══════════════════════════════════════════

data class FavoriteToggleRequest(
    val objectType: String,
    val objectId: Long
)

data class FavoriteItem(
    val id: Long,
    val objectType: String,
    val objectId: Long,
    val objectName: String,
    val isFavorite: Boolean = true,
    val createdAt: OffsetDateTime
)

// ═══════════════════════════════════════════
//  Recent Items
// ═══════════════════════════════════════════

data class RecentItemDto(
    val objectType: String,
    val objectId: Long,
    val objectName: String,
    val viewedAt: OffsetDateTime,
    val viewCount: Int,
    val isFavorite: Boolean = false
)

data class TrackViewRequest(
    val objectType: String,
    val objectId: Long
)

// ═══════════════════════════════════════════
//  Folders
// ═══════════════════════════════════════════

data class FolderCreateRequest(
    val name: String,
    val parentId: Long? = null,
    val icon: String? = null,
    val color: String? = null
)

data class FolderUpdateRequest(
    val name: String? = null,
    val parentId: Long? = null,
    val icon: String? = null,
    val color: String? = null,
    val isShared: Boolean? = null,
    val sortOrder: Int? = null
)

data class FolderDto(
    val id: Long,
    val name: String,
    val parentId: Long?,
    val ownerId: Long,
    val isShared: Boolean,
    val icon: String?,
    val color: String?,
    val sortOrder: Int,
    val itemCount: Int,
    val children: List<FolderDto> = emptyList(),
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime
)

data class FolderItemRequest(
    val objectType: String,
    val objectId: Long
)

data class FolderItemDto(
    val id: Long,
    val folderId: Long,
    val objectType: String,
    val objectId: Long,
    val objectName: String,
    val sortOrder: Int,
    val addedAt: OffsetDateTime
)

// ═══════════════════════════════════════════
//  Home / Dashboard overview
// ═══════════════════════════════════════════

data class WorkspaceOverview(
    val favorites: List<FavoriteItem>,
    val recentItems: List<RecentItemDto>,
    val folders: List<FolderDto>
)
