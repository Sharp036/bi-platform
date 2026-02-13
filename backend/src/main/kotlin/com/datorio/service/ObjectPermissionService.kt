package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ObjectPermissionService(
    private val permRepo: ObjectPermissionRepository,
    private val userRepository: UserRepository,
    private val roleRepository: RoleRepository,
    private val reportRepo: ReportRepository,
    private val auditService: AuditService
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ═══════════════════════════════════════════
    //  Grant / Revoke
    // ═══════════════════════════════════════════

    @Transactional
    fun grantAccess(request: ShareRequest, grantedBy: String): ShareEntry {
        require(request.userId != null || request.roleId != null) {
            "Either userId or roleId must be provided"
        }
        require(request.userId == null || request.roleId == null) {
            "Cannot set both userId and roleId"
        }
        require(request.accessLevel in listOf("VIEW", "EDIT", "ADMIN")) {
            "Invalid access level: ${request.accessLevel}"
        }

        // Check if permission already exists — update access level
        val existing = if (request.userId != null) {
            permRepo.findByObjectTypeAndObjectIdAndUserId(
                request.objectType, request.objectId, request.userId
            )
        } else {
            permRepo.findByObjectTypeAndObjectIdAndRoleId(
                request.objectType, request.objectId, request.roleId!!
            )
        }

        val perm = if (existing != null) {
            existing.accessLevel = request.accessLevel
            permRepo.save(existing)
        } else {
            val newPerm = ObjectPermission(
                objectType = request.objectType,
                objectId = request.objectId,
                accessLevel = request.accessLevel
            )
            if (request.userId != null) {
                newPerm.user = userRepository.findById(request.userId)
                    .orElseThrow { NoSuchElementException("User not found: ${request.userId}") }
            } else {
                newPerm.role = roleRepository.findById(request.roleId!!)
                    .orElseThrow { NoSuchElementException("Role not found: ${request.roleId}") }
            }
            permRepo.save(newPerm)
        }

        auditService.log(grantedBy, "SHARE_GRANT", request.objectType, request.objectId,
            mapOf(
                "userId" to request.userId,
                "roleId" to request.roleId,
                "accessLevel" to request.accessLevel
            ))

        log.info("Granted {} access on {}#{} to user={} role={}",
            request.accessLevel, request.objectType, request.objectId,
            request.userId, request.roleId)

        return perm.toShareEntry()
    }

    @Transactional
    fun bulkGrant(request: BulkShareRequest, grantedBy: String): List<ShareEntry> {
        return request.shares.map { target ->
            grantAccess(
                ShareRequest(
                    objectType = request.objectType,
                    objectId = request.objectId,
                    userId = target.userId,
                    roleId = target.roleId,
                    accessLevel = target.accessLevel
                ),
                grantedBy
            )
        }
    }

    @Transactional
    fun revokeAccess(request: RevokeShareRequest, revokedBy: String) {
        require(request.userId != null || request.roleId != null) {
            "Either userId or roleId must be provided"
        }

        if (request.userId != null) {
            permRepo.deleteByObjectTypeAndObjectIdAndUserId(
                request.objectType, request.objectId, request.userId
            )
        } else {
            permRepo.deleteByObjectTypeAndObjectIdAndRoleId(
                request.objectType, request.objectId, request.roleId!!
            )
        }

        auditService.log(revokedBy, "SHARE_REVOKE", request.objectType, request.objectId,
            mapOf("userId" to request.userId, "roleId" to request.roleId))

        log.info("Revoked access on {}#{} from user={} role={}",
            request.objectType, request.objectId, request.userId, request.roleId)
    }

    // ═══════════════════════════════════════════
    //  Query shares
    // ═══════════════════════════════════════════

    /** List all shares for an object (for the share dialog) */
    fun getObjectShares(objectType: String, objectId: Long): List<ShareEntry> {
        return permRepo.findByObjectTypeAndObjectId(objectType, objectId)
            .map { it.toShareEntry() }
    }

    /** List all objects shared with the current user (directly or via roles) */
    fun getSharedWithUser(userId: Long): List<SharedObjectItem> {
        val user = userRepository.findById(userId)
            .orElseThrow { NoSuchElementException("User not found: $userId") }
        val roleIds = user.roles.map { it.id }

        // Direct user shares
        val directShares = permRepo.findByUserId(userId)

        // Role-based shares
        val roleShares = if (roleIds.isNotEmpty()) {
            permRepo.findByRoleIdIn(roleIds)
        } else emptyList()

        // Merge, keeping highest access level per object
        val merged = (directShares + roleShares)
            .groupBy { "${it.objectType}:${it.objectId}" }
            .map { (_, perms) ->
                val best = perms.maxByOrNull { accessLevelRank(it.accessLevel) }!!
                best
            }

        return merged.map { perm ->
            val name = resolveObjectName(perm.objectType, perm.objectId)
            val ownerName = resolveObjectOwner(perm.objectType, perm.objectId)
            SharedObjectItem(
                objectType = perm.objectType,
                objectId = perm.objectId,
                objectName = name,
                accessLevel = perm.accessLevel,
                sharedBy = ownerName,
                sharedAt = perm.createdAt
            )
        }
    }

    // ═══════════════════════════════════════════
    //  Access checking
    // ═══════════════════════════════════════════

    /** Check if user can access an object at any level */
    fun canAccess(objectType: String, objectId: Long, userId: Long): Boolean {
        val user = userRepository.findById(userId).orElse(null) ?: return false

        // ADMIN role has access to everything
        if (user.roles.any { it.name == "ADMIN" }) return true

        // Check ownership
        if (isOwner(objectType, objectId, userId)) return true

        // Check object-level permissions
        val roleIds = user.roles.map { it.id }.ifEmpty { listOf(-1L) }
        return permRepo.hasAccess(objectType, objectId, userId, roleIds)
    }

    /** Get the effective access level for a user on an object */
    fun getEffectiveAccessLevel(objectType: String, objectId: Long, userId: Long): String? {
        val user = userRepository.findById(userId).orElse(null) ?: return null

        if (user.roles.any { it.name == "ADMIN" }) return "ADMIN"
        if (isOwner(objectType, objectId, userId)) return "ADMIN"

        val roleIds = user.roles.map { it.id }.ifEmpty { listOf(-1L) }
        val levels = permRepo.getAccessLevels(objectType, objectId, userId, roleIds)
        return levels.firstOrNull()
    }

    /** Check if user can edit an object */
    fun canEdit(objectType: String, objectId: Long, userId: Long): Boolean {
        val level = getEffectiveAccessLevel(objectType, objectId, userId)
        return level in listOf("EDIT", "ADMIN")
    }

    // ═══════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════

    private fun isOwner(objectType: String, objectId: Long, userId: Long): Boolean {
        return when (objectType) {
            "REPORT" -> reportRepo.findById(objectId).map { it.createdBy == userId }.orElse(false)
            // DataSource and Dashboard use similar createdBy fields
            else -> false
        }
    }

    private fun resolveObjectName(objectType: String, objectId: Long): String {
        return when (objectType) {
            "REPORT" -> reportRepo.findById(objectId).map { it.name }.orElse("Deleted Report #$objectId")
            else -> "$objectType #$objectId"
        }
    }

    private fun resolveObjectOwner(objectType: String, objectId: Long): String? {
        val ownerId = when (objectType) {
            "REPORT" -> reportRepo.findById(objectId).map { it.createdBy }.orElse(null)
            else -> null
        }
        return ownerId?.let { id ->
            userRepository.findById(id).map { it.displayName ?: it.username }.orElse(null)
        }
    }

    private fun accessLevelRank(level: String): Int = when (level) {
        "ADMIN" -> 3
        "EDIT" -> 2
        "VIEW" -> 1
        else -> 0
    }

    private fun ObjectPermission.toShareEntry() = ShareEntry(
        id = id,
        objectType = objectType,
        objectId = objectId,
        userId = user?.id,
        username = user?.username,
        userDisplayName = user?.displayName,
        roleId = role?.id,
        roleName = role?.name,
        accessLevel = accessLevel,
        createdAt = createdAt
    )
}
