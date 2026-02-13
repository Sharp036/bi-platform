package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.service.InteractiveDashboardService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/interactive")
class InteractiveDashboardController(
    private val service: InteractiveDashboardService
) {

    // ── Chart Layers ──

    @PostMapping("/layers")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun createLayer(@RequestBody req: ChartLayerRequest): ResponseEntity<ChartLayerResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.createLayer(req))

    @PutMapping("/layers/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun updateLayer(@PathVariable id: Long, @RequestBody req: ChartLayerRequest): ChartLayerResponse =
        service.updateLayer(id, req)

    @GetMapping("/layers/widget/{widgetId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getLayersForWidget(@PathVariable widgetId: Long): List<ChartLayerResponse> =
        service.getLayersForWidget(widgetId)

    @DeleteMapping("/layers/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun deleteLayer(@PathVariable id: Long): ResponseEntity<Void> {
        service.deleteLayer(id); return ResponseEntity.noContent().build()
    }

    // ── Dashboard Actions ──

    @PostMapping("/actions")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun createAction(@RequestBody req: DashboardActionRequest): ResponseEntity<DashboardActionResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.createAction(req))

    @PutMapping("/actions/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun updateAction(@PathVariable id: Long, @RequestBody req: DashboardActionRequest): DashboardActionResponse =
        service.updateAction(id, req)

    @GetMapping("/actions/report/{reportId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getActionsForReport(@PathVariable reportId: Long): List<DashboardActionResponse> =
        service.getActionsForReport(reportId)

    @DeleteMapping("/actions/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun deleteAction(@PathVariable id: Long): ResponseEntity<Void> {
        service.deleteAction(id); return ResponseEntity.noContent().build()
    }

    // ── Visibility Rules ──

    @PostMapping("/visibility")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun createRule(@RequestBody req: VisibilityRuleRequest): ResponseEntity<VisibilityRuleResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.createVisibilityRule(req))

    @PutMapping("/visibility/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun updateRule(@PathVariable id: Long, @RequestBody req: VisibilityRuleRequest): VisibilityRuleResponse =
        service.updateVisibilityRule(id, req)

    @GetMapping("/visibility/widget/{widgetId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getRulesForWidget(@PathVariable widgetId: Long): List<VisibilityRuleResponse> =
        service.getRulesForWidget(widgetId)

    @DeleteMapping("/visibility/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun deleteRule(@PathVariable id: Long): ResponseEntity<Void> {
        service.deleteVisibilityRule(id); return ResponseEntity.noContent().build()
    }

    // ── Overlays ──

    @PostMapping("/overlays")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun createOverlay(@RequestBody req: OverlayRequest): ResponseEntity<OverlayResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.createOverlay(req))

    @PutMapping("/overlays/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun updateOverlay(@PathVariable id: Long, @RequestBody req: OverlayRequest): OverlayResponse =
        service.updateOverlay(id, req)

    @GetMapping("/overlays/report/{reportId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getOverlaysForReport(@PathVariable reportId: Long): List<OverlayResponse> =
        service.getOverlaysForReport(reportId)

    @DeleteMapping("/overlays/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun deleteOverlay(@PathVariable id: Long): ResponseEntity<Void> {
        service.deleteOverlay(id); return ResponseEntity.noContent().build()
    }

    // ── Full interactive meta for report ──

    @GetMapping("/meta/report/{reportId}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getInteractiveMeta(
        @PathVariable reportId: Long,
        @RequestParam(defaultValue = "") widgetIds: String
    ): InteractiveReportMeta {
        val ids = widgetIds.split(",").mapNotNull { it.trim().toLongOrNull() }
        return service.getInteractiveMeta(reportId, ids)
    }
}
