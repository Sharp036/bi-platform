package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.repository.UserRepository
import com.datorio.service.ObjectPermissionService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/sharing")
class SharingController(
    private val objectPermissionService: ObjectPermissionService,
    private val userRepository: UserRepository
) {

    /** List all shares for an object */
    @GetMapping("/{objectType}/{objectId}")
    fun getShares(
        @PathVariable objectType: String,
        @PathVariable objectId: Long
    ): ResponseEntity<List<ShareEntry>> {
        return ResponseEntity.ok(
            objectPermissionService.getObjectShares(objectType.uppercase(), objectId)
        )
    }

    /** Grant access to an object */
    @PostMapping("/grant")
    fun grant(
        @Valid @RequestBody request: ShareRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<ShareEntry> {
        return ResponseEntity.ok(
            objectPermissionService.grantAccess(request, user.username)
        )
    }

    /** Bulk grant (share with multiple users/roles at once) */
    @PostMapping("/bulk-grant")
    fun bulkGrant(
        @Valid @RequestBody request: BulkShareRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<List<ShareEntry>> {
        return ResponseEntity.ok(
            objectPermissionService.bulkGrant(request, user.username)
        )
    }

    /** Revoke access */
    @PostMapping("/revoke")
    fun revoke(
        @Valid @RequestBody request: RevokeShareRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Map<String, String>> {
        objectPermissionService.revokeAccess(request, user.username)
        return ResponseEntity.ok(mapOf("message" to "Access revoked"))
    }

    /** Objects shared with the current user */
    @GetMapping("/shared-with-me")
    fun sharedWithMe(
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<List<SharedObjectItem>> {
        val user = userRepository.findByUsername(userDetails.username)
            .orElseThrow { NoSuchElementException("User not found") }
        return ResponseEntity.ok(
            objectPermissionService.getSharedWithUser(user.id)
        )
    }

    /** Check current user's access level on an object */
    @GetMapping("/{objectType}/{objectId}/my-access")
    fun myAccess(
        @PathVariable objectType: String,
        @PathVariable objectId: Long,
        @AuthenticationPrincipal userDetails: UserDetails
    ): ResponseEntity<Map<String, String?>> {
        val user = userRepository.findByUsername(userDetails.username)
            .orElseThrow { NoSuchElementException("User not found") }
        val level = objectPermissionService.getEffectiveAccessLevel(
            objectType.uppercase(), objectId, user.id
        )
        return ResponseEntity.ok(mapOf("accessLevel" to level))
    }
}
