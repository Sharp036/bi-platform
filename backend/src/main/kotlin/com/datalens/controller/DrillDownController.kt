package com.datalens.controller

import com.datalens.model.dto.*
import com.datalens.service.DrillDownService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/drill-actions")
class DrillDownController(
    private val drillDownService: DrillDownService
) {

    @PostMapping
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun create(@RequestBody request: DrillActionCreateRequest): ResponseEntity<DrillActionResponse> {
        return ResponseEntity.status(HttpStatus.CREATED).body(drillDownService.create(request))
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getById(@PathVariable id: Long): DrillActionResponse {
        return drillDownService.getById(id)
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun update(
        @PathVariable id: Long,
        @RequestBody request: DrillActionUpdateRequest
    ): DrillActionResponse {
        return drillDownService.update(id, request)
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        drillDownService.delete(id)
        return ResponseEntity.noContent().build()
    }

    // ── Query actions ──

    @GetMapping("/widget/{widgetId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getActionsForWidget(@PathVariable widgetId: Long): List<DrillActionResponse> {
        return drillDownService.getActionsForWidget(widgetId)
    }

    @GetMapping("/report/{reportId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getActionsForReport(@PathVariable reportId: Long): Map<Long, List<DrillActionResponse>> {
        return drillDownService.getActionsForReport(reportId)
    }

    // ── Navigation ──

    @PostMapping("/navigate")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun navigate(@RequestBody request: DrillNavigateRequest): DrillNavigateResponse {
        return drillDownService.resolveNavigation(request)
    }
}
