package com.datorio.service

import com.datorio.model.Role
import com.datorio.model.dto.*
import com.datorio.repository.PermissionRepository
import com.datorio.repository.RoleRepository
import com.datorio.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class RoleAdminService(
    private val roleRepository: RoleRepository,
    private val permissionRepository: PermissionRepository,
    private val userRepository: UserRepository,
    private val auditService: AuditService
) {

    fun listRoles(): List<RoleListItem> {
        return roleRepository.findAll().map { it.toListItem() }
    }

    fun getRole(id: Long): RoleDetailResponse {
        val role = getEntity(id)
        val userCount = userRepository.countByRolesId(id)
        return RoleDetailResponse(
            id = role.id,
            name = role.name,
            description = role.description,
            isSystem = role.isSystem,
            permissions = role.permissions.map { PermissionItem(it.id, it.code, it.description) },
            userCount = userCount.toInt()
        )
    }

    fun listPermissions(): List<PermissionItem> {
        return permissionRepository.findAll().map {
            PermissionItem(it.id, it.code, it.description)
        }
    }

    @Transactional
    fun createRole(request: RoleCreateRequest, adminUsername: String): RoleDetailResponse {
        require(roleRepository.findByName(request.name).isEmpty) {
            "Role '${request.name}' already exists"
        }

        val permissions = if (request.permissionIds.isNotEmpty()) {
            permissionRepository.findAllById(request.permissionIds).toMutableSet()
        } else mutableSetOf()

        val role = Role(
            name = request.name.uppercase().replace(" ", "_"),
            description = request.description
        )
        role.permissions.addAll(permissions)
        val saved = roleRepository.save(role)

        auditService.log(adminUsername, "ROLE_CREATE", "ROLE", saved.id,
            mapOf("name" to saved.name))

        return getRole(saved.id)
    }

    @Transactional
    fun updateRole(id: Long, request: RoleUpdateRequest, adminUsername: String): RoleDetailResponse {
        val role = getEntity(id)
        require(!role.isSystem) { "Cannot modify system role '${role.name}'" }

        val changes = mutableMapOf<String, Any?>()

        request.name?.let {
            val newName = it.uppercase().replace(" ", "_")
            if (newName != role.name) {
                require(roleRepository.findByName(newName).isEmpty) {
                    "Role '$newName' already exists"
                }
                role.name = newName
                changes["name"] = newName
            }
        }
        request.description?.let {
            role.description = it
            changes["description"] = it
        }
        request.permissionIds?.let { permIds ->
            val newPerms = permissionRepository.findAllById(permIds).toMutableSet()
            role.permissions.clear()
            role.permissions.addAll(newPerms)
            changes["permissions"] = newPerms.map { it.code }
        }

        roleRepository.save(role)
        auditService.log(adminUsername, "ROLE_UPDATE", "ROLE", id, changes)

        return getRole(id)
    }

    @Transactional
    fun deleteRole(id: Long, adminUsername: String) {
        val role = getEntity(id)
        require(!role.isSystem) { "Cannot delete system role '${role.name}'" }

        auditService.log(adminUsername, "ROLE_DELETE", "ROLE", id,
            mapOf("name" to role.name))

        roleRepository.delete(role)
    }

    private fun getEntity(id: Long): Role {
        return roleRepository.findById(id)
            .orElseThrow { NoSuchElementException("Role not found: $id") }
    }

    private fun Role.toListItem() = RoleListItem(
        id = id,
        name = name,
        description = description,
        isSystem = isSystem,
        permissionCount = permissions.size
    )
}
