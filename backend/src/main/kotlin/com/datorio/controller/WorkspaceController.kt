package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.repository.UserRepository
import com.datorio.service.WorkspaceService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/workspace")
class WorkspaceController(
    private val workspaceService: WorkspaceService,
    private val userRepository: UserRepository
) {

    private fun getUserId(userDetails: UserDetails): Long =
        userRepository.findByUsername(userDetails.username)
            .orElseThrow { NoSuchElementException("User not found") }.id

    // ─── Overview ───

    @GetMapping("/overview")
    fun overview(@AuthenticationPrincipal user: UserDetails): ResponseEntity<WorkspaceOverview> {
        return ResponseEntity.ok(workspaceService.getOverview(getUserId(user)))
    }

    // ─── Favorites ───

    @PostMapping("/favorites/toggle")
    fun toggleFavorite(
        @Valid @RequestBody request: FavoriteToggleRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Map<String, Boolean>> {
        val isFav = workspaceService.toggleFavorite(getUserId(user), request.objectType, request.objectId)
        return ResponseEntity.ok(mapOf("isFavorite" to isFav))
    }

    @GetMapping("/favorites")
    fun favorites(
        @RequestParam(required = false) objectType: String?,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<List<FavoriteItem>> {
        return ResponseEntity.ok(workspaceService.getFavorites(getUserId(user), objectType))
    }

    @GetMapping("/favorites/check/{objectType}/{objectId}")
    fun isFavorite(
        @PathVariable objectType: String,
        @PathVariable objectId: Long,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Map<String, Boolean>> {
        val isFav = workspaceService.isFavorite(getUserId(user), objectType.uppercase(), objectId)
        return ResponseEntity.ok(mapOf("isFavorite" to isFav))
    }

    // ─── Recent Items ───

    @PostMapping("/recent/track")
    fun trackView(
        @Valid @RequestBody request: TrackViewRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Void> {
        workspaceService.trackView(getUserId(user), request.objectType, request.objectId)
        return ResponseEntity.ok().build()
    }

    @GetMapping("/recent")
    fun recentItems(
        @RequestParam(defaultValue = "20") limit: Int,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<List<RecentItemDto>> {
        return ResponseEntity.ok(workspaceService.getRecentItems(getUserId(user), limit))
    }

    // ─── Folders ───

    @GetMapping("/folders")
    fun folderTree(
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<List<FolderDto>> {
        return ResponseEntity.ok(workspaceService.getFolderTree(getUserId(user)))
    }

    @PostMapping("/folders")
    fun createFolder(
        @Valid @RequestBody request: FolderCreateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<FolderDto> {
        return ResponseEntity.ok(workspaceService.createFolder(getUserId(user), request))
    }

    @PutMapping("/folders/{id}")
    fun updateFolder(
        @PathVariable id: Long,
        @Valid @RequestBody request: FolderUpdateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<FolderDto> {
        return ResponseEntity.ok(workspaceService.updateFolder(id, getUserId(user), request))
    }

    @DeleteMapping("/folders/{id}")
    fun deleteFolder(
        @PathVariable id: Long,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Void> {
        workspaceService.deleteFolder(id, getUserId(user))
        return ResponseEntity.noContent().build()
    }

    @GetMapping("/folders/{id}/items")
    fun folderContents(@PathVariable id: Long): ResponseEntity<List<FolderItemDto>> {
        return ResponseEntity.ok(workspaceService.getFolderContents(id))
    }

    @PostMapping("/folders/{id}/items")
    fun addToFolder(
        @PathVariable id: Long,
        @Valid @RequestBody request: FolderItemRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<FolderItemDto> {
        return ResponseEntity.ok(
            workspaceService.addToFolder(id, getUserId(user), request.objectType, request.objectId)
        )
    }

    @DeleteMapping("/folders/{id}/items/{objectType}/{objectId}")
    fun removeFromFolder(
        @PathVariable id: Long,
        @PathVariable objectType: String,
        @PathVariable objectId: Long,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<Void> {
        workspaceService.removeFromFolder(id, getUserId(user), objectType.uppercase(), objectId)
        return ResponseEntity.noContent().build()
    }
}
