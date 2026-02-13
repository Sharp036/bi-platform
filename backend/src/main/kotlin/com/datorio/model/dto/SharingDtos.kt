package com.datorio.model.dto

import java.time.OffsetDateTime

// ═══════════════════════════════════════════
//  Sharing DTOs
// ═══════════════════════════════════════════

data class ShareRequest(
    val objectType: String,     // DATASOURCE, REPORT, DASHBOARD
    val objectId: Long,
    val userId: Long? = null,
    val roleId: Long? = null,
    val accessLevel: String = "VIEW"  // VIEW, EDIT, ADMIN
)

data class RevokeShareRequest(
    val objectType: String,
    val objectId: Long,
    val userId: Long? = null,
    val roleId: Long? = null
)

data class ShareEntry(
    val id: Long,
    val objectType: String,
    val objectId: Long,
    val userId: Long?,
    val username: String?,
    val userDisplayName: String?,
    val roleId: Long?,
    val roleName: String?,
    val accessLevel: String,
    val createdAt: OffsetDateTime
)

data class SharedObjectItem(
    val objectType: String,
    val objectId: Long,
    val objectName: String,
    val accessLevel: String,
    val sharedBy: String?,       // owner display name
    val sharedAt: OffsetDateTime
)

data class BulkShareRequest(
    val objectType: String,
    val objectId: Long,
    val shares: List<ShareTarget>
)

data class ShareTarget(
    val userId: Long? = null,
    val roleId: Long? = null,
    val accessLevel: String = "VIEW"
)
