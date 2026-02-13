package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.service.*
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/admin/users")
@PreAuthorize("hasAuthority('USER_MANAGE')")
class UserAdminController(
    private val userAdminService: UserAdminService
) {

    @GetMapping
    fun listUsers(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestParam(required = false) search: String?
    ): ResponseEntity<org.springframework.data.domain.Page<AdminUserListItem>> {
        return ResponseEntity.ok(userAdminService.listUsers(page, size, search))
    }

    @GetMapping("/{id}")
    fun getUser(@PathVariable id: Long): ResponseEntity<AdminUserListItem> {
        return ResponseEntity.ok(userAdminService.getUser(id))
    }

    @PostMapping
    fun createUser(
        @Valid @RequestBody request: AdminUserCreateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<AdminUserListItem> {
        return ResponseEntity.ok(userAdminService.createUser(request, user.username))
    }

    @PutMapping("/{id}")
    fun updateUser(
        @PathVariable id: Long,
        @Valid @RequestBody request: AdminUserUpdateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<AdminUserListItem> {
        return ResponseEntity.ok(userAdminService.updateUser(id, request, user.username))
    }

    @PostMapping("/{id}/reset-password")
    fun resetPassword(
        @PathVariable id: Long,
        @Valid @RequestBody request: AdminResetPasswordRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Map<String, String>> {
        userAdminService.resetPassword(id, request, user.username)
        return ResponseEntity.ok(mapOf("message" to "Password reset successfully"))
    }

    @PostMapping("/{id}/toggle-active")
    fun toggleActive(
        @PathVariable id: Long,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<AdminUserListItem> {
        return ResponseEntity.ok(userAdminService.toggleActive(id, user.username))
    }

    @DeleteMapping("/{id}")
    fun deleteUser(
        @PathVariable id: Long,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Void> {
        userAdminService.deleteUser(id, user.username)
        return ResponseEntity.noContent().build()
    }
}

@RestController
@RequestMapping("/admin/roles")
@PreAuthorize("hasAuthority('USER_MANAGE')")
class RoleAdminController(
    private val roleAdminService: RoleAdminService
) {

    @GetMapping
    fun listRoles(): ResponseEntity<List<RoleListItem>> {
        return ResponseEntity.ok(roleAdminService.listRoles())
    }

    @GetMapping("/{id}")
    fun getRole(@PathVariable id: Long): ResponseEntity<RoleDetailResponse> {
        return ResponseEntity.ok(roleAdminService.getRole(id))
    }

    @GetMapping("/permissions")
    fun listPermissions(): ResponseEntity<List<PermissionItem>> {
        return ResponseEntity.ok(roleAdminService.listPermissions())
    }

    @PostMapping
    fun createRole(
        @Valid @RequestBody request: RoleCreateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<RoleDetailResponse> {
        return ResponseEntity.ok(roleAdminService.createRole(request, user.username))
    }

    @PutMapping("/{id}")
    fun updateRole(
        @PathVariable id: Long,
        @Valid @RequestBody request: RoleUpdateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<RoleDetailResponse> {
        return ResponseEntity.ok(roleAdminService.updateRole(id, request, user.username))
    }

    @DeleteMapping("/{id}")
    fun deleteRole(
        @PathVariable id: Long,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Void> {
        roleAdminService.deleteRole(id, user.username)
        return ResponseEntity.noContent().build()
    }
}

@RestController
@RequestMapping("/admin/audit")
@PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
class AuditLogController(
    private val auditService: AuditService
) {

    @GetMapping
    fun getAuditLog(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
        @RequestParam(required = false) userId: Long?,
        @RequestParam(required = false) action: String?,
        @RequestParam(required = false) objectType: String?
    ): ResponseEntity<org.springframework.data.domain.Page<AuditLogItem>> {
        val filter = AuditLogFilter(userId = userId, action = action, objectType = objectType)
        return ResponseEntity.ok(auditService.getAuditLog(filter, page, size))
    }
}

@RestController
@RequestMapping("/profile")
class ProfileController(
    private val profileService: ProfileService
) {

    @PostMapping("/change-password")
    fun changePassword(
        @Valid @RequestBody request: ChangePasswordRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Map<String, String>> {
        profileService.changePassword(user.username, request)
        return ResponseEntity.ok(mapOf("message" to "Password changed successfully"))
    }
}
