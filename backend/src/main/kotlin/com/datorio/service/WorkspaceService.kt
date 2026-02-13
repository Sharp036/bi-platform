package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class WorkspaceService(
    private val favoriteRepo: FavoriteRepository,
    private val recentItemRepo: RecentItemRepository,
    private val folderRepo: FolderRepository,
    private val folderItemRepo: FolderItemRepository,
    private val reportRepo: ReportRepository,
    private val userRepository: UserRepository
) {

    // ═══════════════════════════════════════════
    //  Favorites
    // ═══════════════════════════════════════════

    @Transactional
    fun toggleFavorite(userId: Long, objectType: String, objectId: Long): Boolean {
        val existing = favoriteRepo.findByUserIdAndObjectTypeAndObjectId(userId, objectType, objectId)
        return if (existing != null) {
            favoriteRepo.delete(existing)
            false // unfavorited
        } else {
            favoriteRepo.save(Favorite(userId = userId, objectType = objectType, objectId = objectId))
            true // favorited
        }
    }

    fun getFavorites(userId: Long, objectType: String? = null): List<FavoriteItem> {
        val favs = if (objectType != null) {
            favoriteRepo.findByUserIdAndObjectType(userId, objectType)
        } else {
            favoriteRepo.findByUserId(userId)
        }
        return favs.map { fav ->
            FavoriteItem(
                id = fav.id,
                objectType = fav.objectType,
                objectId = fav.objectId,
                objectName = resolveObjectName(fav.objectType, fav.objectId),
                createdAt = fav.createdAt
            )
        }
    }

    fun isFavorite(userId: Long, objectType: String, objectId: Long): Boolean {
        return favoriteRepo.existsByUserIdAndObjectTypeAndObjectId(userId, objectType, objectId)
    }

    // ═══════════════════════════════════════════
    //  Recent Items
    // ═══════════════════════════════════════════

    @Transactional
    fun trackView(userId: Long, objectType: String, objectId: Long) {
        val existing = recentItemRepo.findByUserIdAndObjectTypeAndObjectId(userId, objectType, objectId)
        if (existing != null) {
            existing.viewedAt = OffsetDateTime.now()
            existing.viewCount += 1
            recentItemRepo.save(existing)
        } else {
            recentItemRepo.save(
                RecentItem(userId = userId, objectType = objectType, objectId = objectId)
            )
        }
    }

    fun getRecentItems(userId: Long, limit: Int = 20): List<RecentItemDto> {
        val items = recentItemRepo.findByUserIdOrderByViewedAtDesc(
            userId, PageRequest.of(0, limit)
        )
        val favoriteSet = favoriteRepo.findByUserId(userId)
            .map { "${it.objectType}:${it.objectId}" }
            .toSet()

        return items.map { item ->
            RecentItemDto(
                objectType = item.objectType,
                objectId = item.objectId,
                objectName = resolveObjectName(item.objectType, item.objectId),
                viewedAt = item.viewedAt,
                viewCount = item.viewCount,
                isFavorite = "${item.objectType}:${item.objectId}" in favoriteSet
            )
        }
    }

    // ═══════════════════════════════════════════
    //  Folders
    // ═══════════════════════════════════════════

    @Transactional
    fun createFolder(userId: Long, request: FolderCreateRequest): FolderDto {
        val folder = Folder(
            name = request.name,
            parentId = request.parentId,
            ownerId = userId,
            icon = request.icon,
            color = request.color
        )
        val saved = folderRepo.save(folder)
        return saved.toDto(0)
    }

    @Transactional
    fun updateFolder(folderId: Long, userId: Long, request: FolderUpdateRequest): FolderDto {
        val folder = getOwnedFolder(folderId, userId)
        request.name?.let { folder.name = it }
        request.parentId?.let { folder.parentId = it }
        request.icon?.let { folder.icon = it }
        request.color?.let { folder.color = it }
        request.isShared?.let { folder.isShared = it }
        request.sortOrder?.let { folder.sortOrder = it }
        folder.updatedAt = OffsetDateTime.now()
        val saved = folderRepo.save(folder)
        val itemCount = folderItemRepo.countByFolderId(folderId).toInt()
        return saved.toDto(itemCount)
    }

    @Transactional
    fun deleteFolder(folderId: Long, userId: Long) {
        val folder = getOwnedFolder(folderId, userId)
        folderRepo.delete(folder)
    }

    fun getFolderTree(userId: Long): List<FolderDto> {
        val allFolders = folderRepo.findByOwnerId(userId)
        val itemCounts = allFolders.associate { it.id to folderItemRepo.countByFolderId(it.id).toInt() }

        val folderMap = allFolders.map { it.toDto(itemCounts[it.id] ?: 0) }

        // Build tree
        val byParent = folderMap.groupBy { it.parentId }
        fun buildChildren(parentId: Long?): List<FolderDto> {
            return (byParent[parentId] ?: emptyList()).map { folder ->
                folder.copy(children = buildChildren(folder.id))
            }.sortedBy { it.sortOrder }
        }
        return buildChildren(null)
    }

    fun getFolderContents(folderId: Long): List<FolderItemDto> {
        return folderItemRepo.findByFolderIdOrderBySortOrder(folderId).map { item ->
            FolderItemDto(
                id = item.id,
                folderId = item.folderId,
                objectType = item.objectType,
                objectId = item.objectId,
                objectName = resolveObjectName(item.objectType, item.objectId),
                sortOrder = item.sortOrder,
                addedAt = item.addedAt
            )
        }
    }

    @Transactional
    fun addToFolder(folderId: Long, userId: Long, objectType: String, objectId: Long): FolderItemDto {
        getOwnedFolder(folderId, userId)
        val existing = folderItemRepo.findByFolderIdAndObjectTypeAndObjectId(folderId, objectType, objectId)
        if (existing != null) {
            return existing.toDto()
        }
        val item = FolderItem(
            folderId = folderId,
            objectType = objectType,
            objectId = objectId
        )
        val saved = folderItemRepo.save(item)
        return saved.toDto()
    }

    @Transactional
    fun removeFromFolder(folderId: Long, userId: Long, objectType: String, objectId: Long) {
        getOwnedFolder(folderId, userId)
        folderItemRepo.deleteByFolderIdAndObjectTypeAndObjectId(folderId, objectType, objectId)
    }

    // ═══════════════════════════════════════════
    //  Workspace Overview
    // ═══════════════════════════════════════════

    fun getOverview(userId: Long): WorkspaceOverview {
        return WorkspaceOverview(
            favorites = getFavorites(userId),
            recentItems = getRecentItems(userId, 10),
            folders = getFolderTree(userId)
        )
    }

    // ═══════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════

    private fun resolveObjectName(objectType: String, objectId: Long): String {
        return when (objectType) {
            "REPORT" -> reportRepo.findById(objectId).map { it.name }.orElse("Deleted Report #$objectId")
            else -> "$objectType #$objectId"
        }
    }

    private fun getOwnedFolder(folderId: Long, userId: Long): Folder {
        val folder = folderRepo.findById(folderId)
            .orElseThrow { NoSuchElementException("Folder not found: $folderId") }
        require(folder.ownerId == userId) { "Access denied to folder $folderId" }
        return folder
    }

    private fun Folder.toDto(itemCount: Int) = FolderDto(
        id = id, name = name, parentId = parentId,
        ownerId = ownerId, isShared = isShared,
        icon = icon, color = color, sortOrder = sortOrder,
        itemCount = itemCount,
        createdAt = createdAt, updatedAt = updatedAt
    )

    private fun FolderItem.toDto() = FolderItemDto(
        id = id, folderId = folderId,
        objectType = objectType, objectId = objectId,
        objectName = resolveObjectName(objectType, objectId),
        sortOrder = sortOrder, addedAt = addedAt
    )
}
