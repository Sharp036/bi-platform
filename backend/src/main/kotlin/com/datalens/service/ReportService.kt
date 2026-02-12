package com.datalens.service

import com.datalens.model.*
import com.datalens.model.dto.*
import com.datalens.repository.*
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class ReportService(
    private val reportRepo: ReportRepository,
    private val paramRepo: ReportParameterRepository,
    private val widgetRepo: ReportWidgetRepository,
    private val dashboardReportRepo: DashboardReportRepository,
    private val scheduleRepo: ReportScheduleRepository,
    private val snapshotRepo: ReportSnapshotRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ── Report CRUD ──

    @Transactional
    fun createReport(request: CreateReportRequest, userId: Long): ReportResponse {
        val report = Report(
            name = request.name,
            description = request.description,
            reportType = request.reportType,
            layout = request.layout,
            settings = request.settings,
            isTemplate = request.isTemplate,
            folderId = request.folderId,
            createdBy = userId,
            updatedBy = userId
        )
        val saved = reportRepo.save(report)

        // Create parameters
        request.parameters.forEachIndexed { idx, paramDto ->
            val param = ReportParameter(
                report = saved,
                name = paramDto.name,
                label = paramDto.label,
                paramType = paramDto.paramType,
                defaultValue = paramDto.defaultValue,
                isRequired = paramDto.isRequired,
                sortOrder = if (paramDto.sortOrder == 0) idx else paramDto.sortOrder,
                config = paramDto.config
            )
            saved.parameters.add(param)
        }

        // Create widgets
        request.widgets.forEachIndexed { idx, widgetDto ->
            val widget = ReportWidget(
                report = saved,
                widgetType = widgetDto.widgetType,
                title = widgetDto.title,
                queryId = widgetDto.queryId,
                datasourceId = widgetDto.datasourceId,
                rawSql = widgetDto.rawSql,
                chartConfig = widgetDto.chartConfig,
                position = widgetDto.position,
                style = widgetDto.style,
                paramMapping = widgetDto.paramMapping,
                sortOrder = if (widgetDto.sortOrder == 0) idx else widgetDto.sortOrder,
                isVisible = widgetDto.isVisible
            )
            saved.widgets.add(widget)
        }

        val result = reportRepo.save(saved)
        log.info("Created report '{}' (id={}) with {} params, {} widgets",
            result.name, result.id, result.parameters.size, result.widgets.size)
        return toResponse(result)
    }

    fun getReport(id: Long): ReportResponse {
        val report = reportRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Report not found: $id") }
        return toResponse(report)
    }

    fun listReports(
        status: ReportStatus? = null,
        createdBy: Long? = null,
        folderId: Long? = null,
        pageable: Pageable = PageRequest.of(0, 20)
    ): Page<ReportListItem> {
        return reportRepo.findFiltered(status, createdBy, folderId, pageable)
            .map { toListItem(it) }
    }

    fun searchReports(term: String, pageable: Pageable): Page<ReportListItem> {
        return reportRepo.searchByName(term, pageable).map { toListItem(it) }
    }

    fun listTemplates(pageable: Pageable): Page<ReportListItem> {
        return reportRepo.findByIsTemplateTrue(pageable).map { toListItem(it) }
    }

    @Transactional
    fun updateReport(id: Long, request: UpdateReportRequest, userId: Long): ReportResponse {
        val report = reportRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Report not found: $id") }

        request.name?.let { report.name = it }
        request.description?.let { report.description = it }
        request.layout?.let { report.layout = it }
        request.settings?.let { report.settings = it }
        request.status?.let { report.status = it }
        request.isTemplate?.let { report.isTemplate = it }
        request.folderId?.let { report.folderId = it }
        report.updatedBy = userId
        report.updatedAt = Instant.now()

        val saved = reportRepo.save(report)
        log.info("Updated report '{}' (id={})", saved.name, saved.id)
        return toResponse(saved)
    }

    @Transactional
    fun publishReport(id: Long, userId: Long): ReportResponse {
        return updateReport(id, UpdateReportRequest(status = ReportStatus.PUBLISHED), userId)
    }

    @Transactional
    fun archiveReport(id: Long, userId: Long): ReportResponse {
        return updateReport(id, UpdateReportRequest(status = ReportStatus.ARCHIVED), userId)
    }

    @Transactional
    fun duplicateReport(id: Long, newName: String?, userId: Long): ReportResponse {
        val source = reportRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Report not found: $id") }

        val createRequest = CreateReportRequest(
            name = newName ?: "${source.name} (copy)",
            description = source.description,
            reportType = source.reportType,
            layout = source.layout,
            settings = source.settings,
            isTemplate = false,
            folderId = source.folderId,
            parameters = source.parameters.map { p ->
                ReportParameterDto(
                    name = p.name, label = p.label, paramType = p.paramType,
                    defaultValue = p.defaultValue, isRequired = p.isRequired,
                    sortOrder = p.sortOrder, config = p.config
                )
            },
            widgets = source.widgets.map { w ->
                CreateWidgetRequest(
                    widgetType = w.widgetType, title = w.title,
                    queryId = w.queryId, datasourceId = w.datasourceId,
                    rawSql = w.rawSql, chartConfig = w.chartConfig,
                    position = w.position, style = w.style,
                    paramMapping = w.paramMapping, sortOrder = w.sortOrder,
                    isVisible = w.isVisible
                )
            }
        )
        log.info("Duplicating report '{}' (id={}) as '{}'", source.name, id, createRequest.name)
        return createReport(createRequest, userId)
    }

    @Transactional
    fun createFromTemplate(templateId: Long, name: String, userId: Long): ReportResponse {
        val template = reportRepo.findById(templateId)
            .orElseThrow { IllegalArgumentException("Template not found: $templateId") }
        require(template.isTemplate) { "Report $templateId is not a template" }
        return duplicateReport(templateId, name, userId)
    }

    @Transactional
    fun deleteReport(id: Long) {
        require(reportRepo.existsById(id)) { "Report not found: $id" }
        reportRepo.deleteById(id)
        log.info("Deleted report id={}", id)
    }

    // ── Parameter management ──

    @Transactional
    fun setParameters(reportId: Long, params: List<ReportParameterDto>, userId: Long): List<ReportParameterDto> {
        val report = reportRepo.findById(reportId)
            .orElseThrow { IllegalArgumentException("Report not found: $reportId") }

        report.parameters.clear()
        reportRepo.save(report) // flush deletes

        params.forEachIndexed { idx, dto ->
            val param = ReportParameter(
                report = report,
                name = dto.name,
                label = dto.label,
                paramType = dto.paramType,
                defaultValue = dto.defaultValue,
                isRequired = dto.isRequired,
                sortOrder = if (dto.sortOrder == 0) idx else dto.sortOrder,
                config = dto.config
            )
            report.parameters.add(param)
        }

        report.updatedBy = userId
        report.updatedAt = Instant.now()
        reportRepo.save(report)

        return report.parameters.map { toParamDto(it) }
    }

    fun getParameters(reportId: Long): List<ReportParameterDto> {
        return paramRepo.findByReportIdOrderBySortOrder(reportId).map { toParamDto(it) }
    }

    // ── Widget management ──

    @Transactional
    fun addWidget(reportId: Long, request: CreateWidgetRequest, userId: Long): WidgetResponse {
        val report = reportRepo.findById(reportId)
            .orElseThrow { IllegalArgumentException("Report not found: $reportId") }

        val widget = ReportWidget(
            report = report,
            widgetType = request.widgetType,
            title = request.title,
            queryId = request.queryId,
            datasourceId = request.datasourceId,
            rawSql = request.rawSql,
            chartConfig = request.chartConfig,
            position = request.position,
            style = request.style,
            paramMapping = request.paramMapping,
            sortOrder = request.sortOrder,
            isVisible = request.isVisible
        )
        report.widgets.add(widget)
        report.updatedBy = userId
        report.updatedAt = Instant.now()
        reportRepo.save(report)

        val saved = report.widgets.last()
        log.info("Added widget '{}' to report id={}", saved.title ?: saved.widgetType, reportId)
        return toWidgetResponse(saved)
    }

    @Transactional
    fun updateWidget(widgetId: Long, request: UpdateWidgetRequest, userId: Long): WidgetResponse {
        val widget = widgetRepo.findById(widgetId)
            .orElseThrow { IllegalArgumentException("Widget not found: $widgetId") }

        request.title?.let { widget.title = it }
        request.queryId?.let { widget.queryId = it }
        request.datasourceId?.let { widget.datasourceId = it }
        request.rawSql?.let { widget.rawSql = it }
        request.chartConfig?.let { widget.chartConfig = it }
        request.position?.let { widget.position = it }
        request.style?.let { widget.style = it }
        request.paramMapping?.let { widget.paramMapping = it }
        request.sortOrder?.let { widget.sortOrder = it }
        request.isVisible?.let { widget.isVisible = it }
        widget.updatedAt = Instant.now()

        val saved = widgetRepo.save(widget)
        return toWidgetResponse(saved)
    }

    @Transactional
    fun removeWidget(widgetId: Long) {
        require(widgetRepo.existsById(widgetId)) { "Widget not found: $widgetId" }
        widgetRepo.deleteById(widgetId)
    }

    fun getWidgets(reportId: Long): List<WidgetResponse> {
        return widgetRepo.findByReportIdOrderBySortOrder(reportId).map { toWidgetResponse(it) }
    }

    // ── Mapping helpers ──

    private fun toResponse(r: Report) = ReportResponse(
        id = r.id, name = r.name, description = r.description,
        reportType = r.reportType, layout = r.layout, settings = r.settings,
        status = r.status, isTemplate = r.isTemplate, thumbnailUrl = r.thumbnailUrl,
        folderId = r.folderId,
        parameters = r.parameters.map { toParamDto(it) },
        widgets = r.widgets.map { toWidgetResponse(it) },
        createdBy = r.createdBy, updatedBy = r.updatedBy,
        createdAt = r.createdAt, updatedAt = r.updatedAt
    )

    private fun toListItem(r: Report) = ReportListItem(
        id = r.id, name = r.name, description = r.description,
        reportType = r.reportType, status = r.status,
        isTemplate = r.isTemplate, widgetCount = r.widgets.size,
        createdBy = r.createdBy,
        createdAt = r.createdAt, updatedAt = r.updatedAt
    )

    private fun toParamDto(p: ReportParameter) = ReportParameterDto(
        id = p.id, name = p.name, label = p.label, paramType = p.paramType,
        defaultValue = p.defaultValue, isRequired = p.isRequired,
        sortOrder = p.sortOrder, config = p.config
    )

    private fun toWidgetResponse(w: ReportWidget) = WidgetResponse(
        id = w.id, widgetType = w.widgetType, title = w.title,
        queryId = w.queryId, datasourceId = w.datasourceId, rawSql = w.rawSql,
        chartConfig = w.chartConfig, position = w.position, style = w.style,
        paramMapping = w.paramMapping, sortOrder = w.sortOrder,
        isVisible = w.isVisible,
        createdAt = w.createdAt, updatedAt = w.updatedAt
    )
}
