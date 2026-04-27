package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.repository.UserRepository
import com.datorio.service.ImportService
import com.datorio.service.ObjectPermissionService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/import")
class ImportController(
    private val importService: ImportService,
    private val objectPermissionService: ObjectPermissionService,
    private val userRepository: UserRepository,
) {
    private fun isManager(auth: Authentication) =
        auth.authorities.any { it.authority == "IMPORT_MANAGE" }

    private fun getUserId(auth: Authentication): Long =
        userRepository.findByUsername(auth.name).map { it.id }.orElse(0L)

    private fun canAccessSource(id: Long, auth: Authentication): Boolean =
        isManager(auth) || objectPermissionService.canAccess("IMPORT_SOURCE", id, getUserId(auth))

    @GetMapping("/sources")
    @PreAuthorize("hasAnyAuthority('IMPORT_MANAGE', 'IMPORT_UPLOAD')")
    fun listSources(auth: Authentication): ResponseEntity<List<ImportSourceResponse>> {
        val canSeeAll = isManager(auth)
        return ResponseEntity.ok(importService.findAll(auth.name, canSeeAll))
    }

    @GetMapping("/sources/{id}")
    @PreAuthorize("hasAnyAuthority('IMPORT_MANAGE', 'IMPORT_UPLOAD')")
    fun getSource(@PathVariable id: Long, auth: Authentication): ResponseEntity<ImportSourceResponse> {
        if (!canAccessSource(id, auth)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        return ResponseEntity.ok(importService.findById(id))
    }

    @PostMapping("/sources")
    @PreAuthorize("hasAuthority('IMPORT_MANAGE')")
    fun createSource(
        @Valid @RequestBody req: ImportSourceRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<ImportSourceResponse> =
        ResponseEntity.ok(importService.create(req, user.username))

    @PutMapping("/sources/{id}")
    @PreAuthorize("hasAuthority('IMPORT_MANAGE')")
    fun updateSource(
        @PathVariable id: Long,
        @Valid @RequestBody req: ImportSourceRequest,
    ): ResponseEntity<ImportSourceResponse> =
        ResponseEntity.ok(importService.update(id, req))

    @DeleteMapping("/sources/{id}")
    @PreAuthorize("hasAuthority('IMPORT_MANAGE')")
    fun deleteSource(@PathVariable id: Long): ResponseEntity<Void> {
        importService.delete(id)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/sources/{id}/preview", consumes = ["multipart/form-data"])
    @PreAuthorize("hasAnyAuthority('IMPORT_MANAGE', 'IMPORT_UPLOAD')")
    fun preview(
        @PathVariable id: Long,
        @RequestParam("file") file: MultipartFile,
        auth: Authentication,
    ): ResponseEntity<ImportPreviewResponse> {
        if (!canAccessSource(id, auth)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        return ResponseEntity.ok(importService.preview(id, file))
    }

    @PostMapping("/sources/{id}/upload", consumes = ["multipart/form-data"])
    @PreAuthorize("hasAuthority('IMPORT_UPLOAD')")
    fun upload(
        @PathVariable id: Long,
        @RequestParam("file") file: MultipartFile,
        @AuthenticationPrincipal user: UserDetails,
        auth: Authentication,
    ): ResponseEntity<ImportUploadResult> {
        if (!canAccessSource(id, auth)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        return ResponseEntity.ok(importService.upload(id, file, user.username))
    }

    @PostMapping("/sources/{id}/upload", consumes = ["application/json"])
    @PreAuthorize("hasAuthority('IMPORT_UPLOAD')")
    fun uploadJson(
        @PathVariable id: Long,
        @RequestBody rows: List<Map<String, Any?>>,
        @AuthenticationPrincipal user: UserDetails,
        auth: Authentication,
    ): ResponseEntity<ImportUploadResult> {
        if (!canAccessSource(id, auth)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        return ResponseEntity.ok(importService.uploadRows(id, rows, user.username))
    }

    @GetMapping("/logs")
    @PreAuthorize("hasAnyAuthority('IMPORT_MANAGE', 'IMPORT_UPLOAD')")
    fun getLogs(
        @AuthenticationPrincipal user: UserDetails,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
        @RequestParam(defaultValue = "uploadedAt") sort: String,
        @RequestParam(defaultValue = "desc") sortDir: String,
        @RequestParam(required = false) sourceName: String?,
        @RequestParam(required = false) filename: String?,
        @RequestParam(required = false) uploadedBy: String?,
        @RequestParam(required = false) status: String?,
    ): ResponseEntity<PageResponse<ImportLogResponse>> {
        val showAll = user.authorities.any { it.authority == "IMPORT_MANAGE" }
        return ResponseEntity.ok(importService.getLogs(
            username = user.username,
            showAll = showAll,
            page = page,
            size = size,
            sort = sort,
            sortDir = sortDir,
            sourceName = sourceName,
            filename = filename,
            userFilter = uploadedBy,
            status = status,
        ))
    }

    @GetMapping("/logs/{id}/errors")
    @PreAuthorize("hasAnyAuthority('IMPORT_MANAGE', 'IMPORT_UPLOAD')")
    fun getErrors(@PathVariable id: Long): ResponseEntity<List<ImportErrorDetail>> =
        ResponseEntity.ok(importService.getErrors(id))
}
