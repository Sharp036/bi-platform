package com.datorio.repository

import com.datorio.model.Favorite
import com.datorio.model.Folder
import com.datorio.model.FolderItem
import com.datorio.model.RecentItem
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface FavoriteRepository : JpaRepository<Favorite, Long> {
    fun findByUserId(userId: Long): List<Favorite>
    fun findByUserIdAndObjectType(userId: Long, objectType: String): List<Favorite>
    fun findByUserIdAndObjectTypeAndObjectId(userId: Long, objectType: String, objectId: Long): Favorite?
    fun existsByUserIdAndObjectTypeAndObjectId(userId: Long, objectType: String, objectId: Long): Boolean
    fun deleteByUserIdAndObjectTypeAndObjectId(userId: Long, objectType: String, objectId: Long)
}

@Repository
interface RecentItemRepository : JpaRepository<RecentItem, Long> {
    fun findByUserIdOrderByViewedAtDesc(userId: Long, pageable: Pageable): List<RecentItem>
    fun findByUserIdAndObjectTypeAndObjectId(userId: Long, objectType: String, objectId: Long): RecentItem?
}

@Repository
interface FolderRepository : JpaRepository<Folder, Long> {
    fun findByOwnerId(ownerId: Long): List<Folder>
    fun findByOwnerIdAndParentIdIsNull(ownerId: Long): List<Folder>
    fun findByParentId(parentId: Long): List<Folder>
    fun findByOwnerIdOrIsSharedTrue(ownerId: Long): List<Folder>
}

@Repository
interface FolderItemRepository : JpaRepository<FolderItem, Long> {
    fun findByFolderIdOrderBySortOrder(folderId: Long): List<FolderItem>
    fun findByFolderIdAndObjectTypeAndObjectId(folderId: Long, objectType: String, objectId: Long): FolderItem?
    fun deleteByFolderIdAndObjectTypeAndObjectId(folderId: Long, objectType: String, objectId: Long)
    fun countByFolderId(folderId: Long): Long
}
