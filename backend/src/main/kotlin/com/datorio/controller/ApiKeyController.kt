package com.datorio.controller

import com.datorio.model.dto.ApiKeyCreateRequest
import com.datorio.model.dto.ApiKeyCreatedResponse
import com.datorio.model.dto.ApiKeyResponse
import com.datorio.service.ApiKeyService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api-keys")
class ApiKeyController(private val apiKeyService: ApiKeyService) {

    @GetMapping
    @PreAuthorize("hasAuthority('IMPORT_MANAGE')")
    fun list(@AuthenticationPrincipal user: UserDetails): ResponseEntity<List<ApiKeyResponse>> =
        ResponseEntity.ok(apiKeyService.list(user.username))

    @PostMapping
    @PreAuthorize("hasAuthority('IMPORT_MANAGE')")
    fun create(
        @Valid @RequestBody req: ApiKeyCreateRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<ApiKeyCreatedResponse> =
        ResponseEntity.ok(apiKeyService.create(req, user.username))

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('IMPORT_MANAGE')")
    fun revoke(
        @PathVariable id: Long,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Void> {
        apiKeyService.revoke(id, user.username)
        return ResponseEntity.noContent().build()
    }
}
