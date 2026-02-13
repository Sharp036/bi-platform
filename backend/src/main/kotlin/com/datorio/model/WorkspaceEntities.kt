package com.datorio.model

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "dl_favorite")
class Favorite(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "object_type", nullable = false, length = 50)
    val objectType: String,

    @Column(name = "object_id", nullable = false)
    val objectId: Long,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

@Entity
@Table(name = "dl_recent_item")
class RecentItem(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "object_type", nullable = false, length = 50)
    val objectType: String,

    @Column(name = "object_id", nullable = false)
    val objectId: Long,

    @Column(name = "viewed_at", nullable = false)
    var viewedAt: OffsetDateTime = OffsetDateTime.now(),

    @Column(name = "view_count", nullable = false)
    var viewCount: Int = 1
)

@Entity
@Table(name = "dl_folder")
class Folder(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 200)
    var name: String,

    @Column(name = "parent_id")
    var parentId: Long? = null,

    @Column(name = "owner_id", nullable = false)
    val ownerId: Long,

    @Column(name = "is_shared", nullable = false)
    var isShared: Boolean = false,

    @Column(length = 50)
    var icon: String? = null,

    @Column(length = 20)
    var color: String? = null,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now()
)

@Entity
@Table(name = "dl_folder_item")
class FolderItem(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "folder_id", nullable = false)
    val folderId: Long,

    @Column(name = "object_type", nullable = false, length = 50)
    val objectType: String,

    @Column(name = "object_id", nullable = false)
    val objectId: Long,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "added_at", nullable = false, updatable = false)
    val addedAt: OffsetDateTime = OffsetDateTime.now()
)
