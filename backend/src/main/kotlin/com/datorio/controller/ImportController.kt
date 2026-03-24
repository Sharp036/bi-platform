package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.service.ImportService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/import")
class ImportController(private val importService: ImportService) {

    @GetMapping("/sources")
    @PreAuthorize("hasAuthority('IMPORT_MANAGE')")
    fun listSources(): ResponseEntity<List<ImportSourceResponse>> =
        ResponseEntity.ok(importService.findAll())

    @GetMapping("/sources/{id}")
    @PreAuthorize("hasAnyAuthority('IMPORT_MANAGE', 'IMPORT_UPLOAD')")
    fun getSource(@PathVariable id: Long): ResponseEntity<ImportSourceResponse> =
        ResponseEntity.ok(importService.findById(id))

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
    ): ResponseEntity<ImportPreviewResponse> =
        ResponseEntity.ok(importService.preview(id, file))

    @PostMapping("/sources/{id}/upload", consumes = ["multipart/form-data"])
    @PreAuthorize("hasAuthority('IMPORT_UPLOAD')")
    fun upload(
        @PathVariable id: Long,
        @RequestParam("file") file: MultipartFile,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<ImportUploadResult> =
        ResponseEntity.ok(importService.upload(id, file, user.username))

    @GetMapping("/logs")
    @PreAuthorize("hasAnyAuthority('IMPORT_MANAGE', 'IMPORT_UPLOAD')")
    fun getLogs(): ResponseEntity<List<ImportLogResponse>> =
        ResponseEntity.ok(importService.getLogs())

    @GetMapping("/logs/{id}/errors")
    @PreAuthorize("hasAnyAuthority('IMPORT_MANAGE', 'IMPORT_UPLOAD')")
    fun getErrors(@PathVariable id: Long): ResponseEntity<List<ImportErrorDetail>> =
        ResponseEntity.ok(importService.getErrors(id))
}
