package com.datorio.model.dto

import java.time.OffsetDateTime

// ═══════════════════════════════════════════════
//  User Management DTOs
// ═══════════════════════════════════════════════

data class AdminUserListItem(
    val id: Long,
    val username: String,
    val email: String,
    val displayName: String?,
    val isActive: Boolean,
    val roles: List<RoleListItem>,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime
)

data class AdminUserCreateRequest(
    val username: String,
    val email: String,
    val password: String,
    val displayName: String? = null,
    val roleIds: List<Long> = emptyList(),
    val isActive: Boolean = true
)

data class AdminUserUpdateRequest(
    val email: String? = null,
    val displayName: String? = null,
    val isActive: Boolean? = null,
    val roleIds: List<Long>? = null
)

data class AdminResetPasswordRequest(
    val newPassword: String
)

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)

// ═══════════════════════════════════════════════
//  Role Management DTOs
// ═══════════════════════════════════════════════

data class RoleListItem(
    val id: Long,
    val name: String,
    val description: String?,
    val isSystem: Boolean,
    val permissionCount: Int
)

data class RoleDetailResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val isSystem: Boolean,
    val permissions: List<PermissionItem>,
    val userCount: Int
)

data class RoleCreateRequest(
    val name: String,
    val description: String? = null,
    val permissionIds: List<Long> = emptyList()
)

data class RoleUpdateRequest(
    val name: String? = null,
    val description: String? = null,
    val permissionIds: List<Long>? = null
)

// ═══════════════════════════════════════════════
//  Permission DTOs
// ═══════════════════════════════════════════════

data class PermissionItem(
    val id: Long,
    val code: String,
    val description: String?
)

// ═══════════════════════════════════════════════
//  Audit Log DTOs
// ═══════════════════════════════════════════════

data class AuditLogItem(
    val id: Long,
    val userId: Long?,
    val username: String?,
    val action: String,
    val objectType: String?,
    val objectId: Long?,
    val details: Map<String, Any?>,
    val ipAddress: String?,
    val createdAt: OffsetDateTime
)

data class AuditLogFilter(
    val userId: Long? = null,
    val action: String? = null,
    val objectType: String? = null,
    val from: OffsetDateTime? = null,
    val to: OffsetDateTime? = null
)
