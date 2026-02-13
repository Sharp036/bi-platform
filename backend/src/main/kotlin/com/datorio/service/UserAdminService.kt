package com.datorio.service

import com.datorio.model.User
import com.datorio.model.dto.*
import com.datorio.repository.RoleRepository
import com.datorio.repository.UserRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class UserAdminService(
    private val userRepository: UserRepository,
    private val roleRepository: RoleRepository,
    private val passwordEncoder: PasswordEncoder,
    private val auditService: AuditService
) {

    fun listUsers(page: Int, size: Int, search: String?): Page<AdminUserListItem> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        val usersPage = if (search.isNullOrBlank()) {
            userRepository.findAll(pageable)
        } else {
            userRepository.findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(
                search, search, pageable
            )
        }
        return usersPage.map { it.toListItem() }
    }

    fun getUser(id: Long): AdminUserListItem {
        return getEntity(id).toListItem()
    }

    @Transactional
    fun createUser(request: AdminUserCreateRequest, adminUsername: String): AdminUserListItem {
        require(!userRepository.existsByUsername(request.username)) {
            "Username '${request.username}' already exists"
        }
        require(!userRepository.existsByEmail(request.email)) {
            "Email '${request.email}' already registered"
        }

        val roles = if (request.roleIds.isNotEmpty()) {
            roleRepository.findAllById(request.roleIds).toMutableSet()
        } else {
            val viewer = roleRepository.findByName("VIEWER")
                .orElseThrow { IllegalStateException("VIEWER role not found") }
            mutableSetOf(viewer)
        }

        val user = User(
            username = request.username,
            email = request.email,
            passwordHash = passwordEncoder.encode(request.password),
            displayName = request.displayName,
            isActive = request.isActive
        )
        user.roles.addAll(roles)
        val saved = userRepository.save(user)

        auditService.log(adminUsername, "USER_CREATE", "USER", saved.id,
            mapOf("username" to saved.username))

        return saved.toListItem()
    }

    @Transactional
    fun updateUser(id: Long, request: AdminUserUpdateRequest, adminUsername: String): AdminUserListItem {
        val user = getEntity(id)
        val changes = mutableMapOf<String, Any?>()

        request.email?.let {
            if (it != user.email) {
                require(!userRepository.existsByEmail(it)) { "Email '$it' already registered" }
                user.email = it
                changes["email"] = it
            }
        }
        request.displayName?.let {
            user.displayName = it
            changes["displayName"] = it
        }
        request.isActive?.let {
            user.isActive = it
            changes["isActive"] = it
        }
        request.roleIds?.let { roleIds ->
            val newRoles = roleRepository.findAllById(roleIds).toMutableSet()
            user.roles.clear()
            user.roles.addAll(newRoles)
            changes["roles"] = newRoles.map { it.name }
        }

        user.updatedAt = OffsetDateTime.now()
        val saved = userRepository.save(user)

        auditService.log(adminUsername, "USER_UPDATE", "USER", id, changes)

        return saved.toListItem()
    }

    @Transactional
    fun resetPassword(id: Long, request: AdminResetPasswordRequest, adminUsername: String) {
        val user = getEntity(id)
        user.passwordHash = passwordEncoder.encode(request.newPassword)
        user.updatedAt = OffsetDateTime.now()
        userRepository.save(user)

        auditService.log(adminUsername, "USER_PASSWORD_RESET", "USER", id,
            mapOf("username" to user.username))
    }

    @Transactional
    fun deleteUser(id: Long, adminUsername: String) {
        val user = getEntity(id)
        require(user.username != "admin") { "Cannot delete the system admin account" }

        auditService.log(adminUsername, "USER_DELETE", "USER", id,
            mapOf("username" to user.username))

        userRepository.delete(user)
    }

    @Transactional
    fun toggleActive(id: Long, adminUsername: String): AdminUserListItem {
        val user = getEntity(id)
        require(user.username != "admin") { "Cannot deactivate the system admin account" }
        user.isActive = !user.isActive
        user.updatedAt = OffsetDateTime.now()
        val saved = userRepository.save(user)

        auditService.log(adminUsername, if (saved.isActive) "USER_ACTIVATE" else "USER_DEACTIVATE",
            "USER", id, mapOf("username" to user.username))

        return saved.toListItem()
    }

    private fun getEntity(id: Long): User {
        return userRepository.findById(id)
            .orElseThrow { NoSuchElementException("User not found: $id") }
    }

    private fun User.toListItem() = AdminUserListItem(
        id = id,
        username = username,
        email = email,
        displayName = displayName,
        isActive = isActive,
        roles = roles.map { RoleListItem(it.id, it.name, it.description, it.isSystem, it.permissions.size) },
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}
