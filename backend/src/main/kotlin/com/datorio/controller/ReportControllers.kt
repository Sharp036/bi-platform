package com.datorio.controller

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.service.*
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

// ═══════════════════════════════════════════════
//  Report Controller
// ═══════════════════════════════════════════════

@RestController
@RequestMapping("/reports")
class ReportController(
    private val reportService: ReportService,
    private val renderService: ReportRenderService
) {

    @PostMapping
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun createReport(
        @RequestBody request: CreateReportRequest,
        auth: Authentication
    ): ResponseEntity<ReportResponse> {
        val userId = getUserId(auth)
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(reportService.createReport(request, userId))
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getReport(@PathVariable id: Long): ResponseEntity<ReportResponse> {
        return ResponseEntity.ok(reportService.getReport(id))
    }

    @GetMapping
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun listReports(
        @RequestParam(required = false) status: ReportStatus?,
        @RequestParam(required = false) folderId: Long?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        auth: Authentication
    ): ResponseEntity<Any> {
        val result = reportService.listReports(
            status = status,
            folderId = folderId,
            pageable = PageRequest.of(page, size)
        )
        return ResponseEntity.ok(mapOf(
            "content" to result.content,
            "totalElements" to result.totalElements,
            "totalPages" to result.totalPages,
            "page" to page
        ))
    }

    @GetMapping("/search")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun searchReports(
        @RequestParam q: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<Any> {
        val result = reportService.searchReports(q, PageRequest.of(page, size))
        return ResponseEntity.ok(mapOf(
            "content" to result.content,
            "totalElements" to result.totalElements,
            "totalPages" to result.totalPages
        ))
    }

    @GetMapping("/templates")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun listTemplates(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<Any> {
        val result = reportService.listTemplates(PageRequest.of(page, size))
        return ResponseEntity.ok(mapOf(
            "content" to result.content,
            "totalElements" to result.totalElements
        ))
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun updateReport(
        @PathVariable id: Long,
        @RequestBody request: UpdateReportRequest,
        auth: Authentication
    ): ResponseEntity<ReportResponse> {
        return ResponseEntity.ok(reportService.updateReport(id, request, getUserId(auth)))
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAuthority('REPORT_PUBLISH')")
    fun publishReport(@PathVariable id: Long, auth: Authentication): ResponseEntity<ReportResponse> {
        return ResponseEntity.ok(reportService.publishReport(id, getUserId(auth)))
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun archiveReport(@PathVariable id: Long, auth: Authentication): ResponseEntity<ReportResponse> {
        return ResponseEntity.ok(reportService.archiveReport(id, getUserId(auth)))
    }

    @PostMapping("/{id}/duplicate")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun duplicateReport(
        @PathVariable id: Long,
        @RequestParam(required = false) name: String?,
        auth: Authentication
    ): ResponseEntity<ReportResponse> {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(reportService.duplicateReport(id, name, getUserId(auth)))
    }

    @PostMapping("/from-template/{templateId}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun createFromTemplate(
        @PathVariable templateId: Long,
        @RequestParam name: String,
        auth: Authentication
    ): ResponseEntity<ReportResponse> {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(reportService.createFromTemplate(templateId, name, getUserId(auth)))
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun deleteReport(@PathVariable id: Long): ResponseEntity<Void> {
        reportService.deleteReport(id)
        return ResponseEntity.noContent().build()
    }

    // ── Parameters ──

    @GetMapping("/{id}/parameters")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getParameters(@PathVariable id: Long): ResponseEntity<List<ReportParameterDto>> {
        return ResponseEntity.ok(reportService.getParameters(id))
    }

    @PutMapping("/{id}/parameters")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun setParameters(
        @PathVariable id: Long,
        @RequestBody params: List<ReportParameterDto>,
        auth: Authentication
    ): ResponseEntity<List<ReportParameterDto>> {
        return ResponseEntity.ok(reportService.setParameters(id, params, getUserId(auth)))
    }

    // ── Widgets ──

    @GetMapping("/{id}/widgets")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getWidgets(@PathVariable id: Long): ResponseEntity<List<WidgetResponse>> {
        return ResponseEntity.ok(reportService.getWidgets(id))
    }

    @PostMapping("/{id}/widgets")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun addWidget(
        @PathVariable id: Long,
        @RequestBody request: CreateWidgetRequest,
        auth: Authentication
    ): ResponseEntity<WidgetResponse> {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(reportService.addWidget(id, request, getUserId(auth)))
    }

    @PutMapping("/widgets/{widgetId}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun updateWidget(
        @PathVariable widgetId: Long,
        @RequestBody request: UpdateWidgetRequest,
        auth: Authentication
    ): ResponseEntity<WidgetResponse> {
        return ResponseEntity.ok(reportService.updateWidget(widgetId, request, getUserId(auth)))
    }

    @DeleteMapping("/widgets/{widgetId}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun removeWidget(@PathVariable widgetId: Long): ResponseEntity<Void> {
        reportService.removeWidget(widgetId)
        return ResponseEntity.noContent().build()
    }

    // ── Render (server-side data fetch) ──

    @PostMapping("/{id}/render")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun renderReport(
        @PathVariable id: Long,
        @RequestBody(required = false) request: RenderReportRequest?,
        auth: Authentication
    ): ResponseEntity<RenderReportResponse> {
        return ResponseEntity.ok(
            renderService.renderReport(id, request ?: RenderReportRequest(), getUsername(auth))
        )
    }

    // ── Snapshots ──

    @PostMapping("/{id}/snapshot")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun createSnapshot(
        @PathVariable id: Long,
        @RequestBody(required = false) request: RenderReportRequest?,
        auth: Authentication
    ): ResponseEntity<SnapshotResponse> {
        val snapshot = renderService.renderAndSnapshot(
            reportId = id,
            params = request?.parameters ?: emptyMap(),
            username = getUsername(auth)
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(
            SnapshotResponse(
                id = snapshot.id, reportId = snapshot.reportId,
                scheduleId = snapshot.scheduleId, parameters = snapshot.parameters,
                outputFormat = snapshot.outputFormat, status = snapshot.status,
                executionMs = snapshot.executionMs, errorMessage = snapshot.errorMessage,
                createdBy = snapshot.createdBy, createdAt = snapshot.createdAt
            )
        )
    }

    @GetMapping("/{id}/snapshots")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun listSnapshots(
        @PathVariable id: Long,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<List<SnapshotResponse>> {
        return ResponseEntity.ok(renderService.listSnapshots(id, page, size))
    }

    @GetMapping("/{id}/snapshots/latest")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getLatestSnapshot(@PathVariable id: Long): ResponseEntity<Any> {
        val snapshot = renderService.getLatestSnapshot(id)
        return if (snapshot != null) ResponseEntity.ok(snapshot)
        else ResponseEntity.noContent().build()
    }

    // ── Helpers ──

    private fun getUsername(auth: Authentication): String {
        return auth.name
    }

    private fun getUserId(auth: Authentication): Long {
        return try {
            val principal = auth.principal
            if (principal is org.springframework.security.core.userdetails.UserDetails) {
                principal.username.hashCode().toLong()
            } else { 0L }
        } catch (_: Exception) { 0L }
    }
}

// ═══════════════════════════════════════════════
//  Schedule Controller
// ═══════════════════════════════════════════════

@RestController
@RequestMapping("/schedules")
class ReportScheduleController(
    private val scheduleService: ReportScheduleService
) {

    @PostMapping
    @PreAuthorize("hasAuthority('SCHEDULE_MANAGE')")
    fun createSchedule(
        @RequestBody request: CreateScheduleRequest,
        auth: Authentication
    ): ResponseEntity<ScheduleResponse> {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(scheduleService.createSchedule(request, auth.name))
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SCHEDULE_MANAGE')")
    fun getSchedule(@PathVariable id: Long): ResponseEntity<ScheduleResponse> {
        return ResponseEntity.ok(scheduleService.getSchedule(id))
    }

    @GetMapping
    @PreAuthorize("hasAuthority('SCHEDULE_MANAGE')")
    fun listActiveSchedules(): ResponseEntity<List<ScheduleResponse>> {
        return ResponseEntity.ok(scheduleService.listActiveSchedules())
    }

    @GetMapping("/report/{reportId}")
    @PreAuthorize("hasAuthority('SCHEDULE_MANAGE')")
    fun listSchedulesForReport(@PathVariable reportId: Long): ResponseEntity<List<ScheduleResponse>> {
        return ResponseEntity.ok(scheduleService.listSchedulesForReport(reportId))
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SCHEDULE_MANAGE')")
    fun updateSchedule(
        @PathVariable id: Long,
        @RequestBody request: UpdateScheduleRequest
    ): ResponseEntity<ScheduleResponse> {
        return ResponseEntity.ok(scheduleService.updateSchedule(id, request))
    }

    @PostMapping("/{id}/toggle")
    @PreAuthorize("hasAuthority('SCHEDULE_MANAGE')")
    fun toggleSchedule(@PathVariable id: Long): ResponseEntity<ScheduleResponse> {
        return ResponseEntity.ok(scheduleService.toggleSchedule(id))
    }

    @PostMapping("/{id}/execute")
    @PreAuthorize("hasAuthority('SCHEDULE_MANAGE')")
    fun executeNow(@PathVariable id: Long, auth: Authentication): ResponseEntity<Any> {
        val snapshot = scheduleService.executeSchedule(id, auth.name)
        return ResponseEntity.ok(mapOf(
            "snapshotId" to snapshot.id,
            "status" to snapshot.status,
            "executionMs" to snapshot.executionMs
        ))
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SCHEDULE_MANAGE')")
    fun deleteSchedule(@PathVariable id: Long): ResponseEntity<Void> {
        scheduleService.deleteSchedule(id)
        return ResponseEntity.noContent().build()
    }
}

// ═══════════════════════════════════════════════
//  Dashboard-Report Controller (extends existing dashboard)
// ═══════════════════════════════════════════════

@RestController
@RequestMapping("/dashboards/{dashboardId}/reports")
class DashboardReportController(
    private val dashboardService: DashboardService
) {

    @GetMapping
    @PreAuthorize("hasAuthority('DASHBOARD_VIEW')")
    fun getReports(@PathVariable dashboardId: Long): ResponseEntity<List<DashboardReportItem>> {
        return ResponseEntity.ok(dashboardService.getDashboardReports(dashboardId))
    }

    @PostMapping
    @PreAuthorize("hasAuthority('DASHBOARD_EDIT')")
    fun addReport(
        @PathVariable dashboardId: Long,
        @RequestBody request: DashboardReportRequest
    ): ResponseEntity<Any> {
        val dr = dashboardService.addReportToDashboard(dashboardId, request)
        return ResponseEntity.status(HttpStatus.CREATED).body(mapOf(
            "id" to dr.id,
            "dashboardId" to dr.dashboardId,
            "reportId" to dr.reportId
        ))
    }

    @DeleteMapping("/{reportId}")
    @PreAuthorize("hasAuthority('DASHBOARD_EDIT')")
    fun removeReport(
        @PathVariable dashboardId: Long,
        @PathVariable reportId: Long
    ): ResponseEntity<Void> {
        dashboardService.removeReportFromDashboard(dashboardId, reportId)
        return ResponseEntity.noContent().build()
    }
}
