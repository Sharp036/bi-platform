package com.datalens.controller

import com.datalens.model.dto.*
import com.datalens.service.ExportService
import com.datalens.service.EmailService
import org.springframework.http.*
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/export")
class ExportController(
    private val exportService: ExportService,
    private val emailService: EmailService
) {

    /**
     * Export report directly (streaming download).
     */
    @PostMapping("/reports/{reportId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun exportReport(
        @PathVariable reportId: Long,
        @RequestBody request: ExportRequest,
        auth: Authentication
    ): ResponseEntity<ByteArray> {
        val (bytes, filename) = exportService.exportReport(reportId, request, auth.name)

        val contentType = when (request.format.uppercase()) {
            "CSV" -> MediaType.parseMediaType("text/csv; charset=UTF-8")
            "EXCEL", "XLSX" -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            "PDF" -> MediaType.APPLICATION_PDF
            else -> MediaType.APPLICATION_OCTET_STREAM
        }

        return ResponseEntity.ok()
            .contentType(contentType)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"$filename\"")
            .header(HttpHeaders.CONTENT_LENGTH, bytes.size.toString())
            .body(bytes)
    }

    /**
     * Export and save as snapshot (returns download URL).
     */
    @PostMapping("/reports/{reportId}/save")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun exportAndSave(
        @PathVariable reportId: Long,
        @RequestBody request: ExportRequest,
        auth: Authentication
    ): ResponseEntity<ExportStatusResponse> {
        return ResponseEntity.ok(exportService.exportAndSave(reportId, request, auth.name))
    }

    /**
     * Download a previously saved export by snapshot ID.
     */
    @GetMapping("/download/{snapshotId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun downloadExport(@PathVariable snapshotId: Long): ResponseEntity<ByteArray> {
        val result = exportService.getExportFile(snapshotId)
            ?: return ResponseEntity.notFound().build()

        val (bytes, filename, contentType) = result

        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(contentType))
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"$filename\"")
            .body(bytes)
    }

    /**
     * Send report via email.
     */
    @PostMapping("/reports/{reportId}/email")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun emailReport(
        @PathVariable reportId: Long,
        @RequestBody request: EmailDeliveryRequest,
        auth: Authentication
    ): ResponseEntity<EmailDeliveryResponse> {
        val emailRequest = request.copy(reportId = reportId)
        return ResponseEntity.ok(emailService.sendReportEmail(emailRequest, auth.name))
    }
}
