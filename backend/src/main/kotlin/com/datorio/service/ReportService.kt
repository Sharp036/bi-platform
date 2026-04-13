package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
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
    private val snapshotRepo: ReportSnapshotRepository,
    private val vizService: VisualizationService,
    private val interactiveService: InteractiveDashboardService,
    private val controlService: ControlService,
    private val drillService: DrillDownService,
    private val objectMapper: ObjectMapper
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

    fun resolveReport(idOrSlug: String): Report {
        val asLong = idOrSlug.toLongOrNull()
        return if (asLong != null) {
            reportRepo.findById(asLong)
                .orElseGet { reportRepo.findBySlug(idOrSlug).orElseThrow { IllegalArgumentException("Report not found: $idOrSlug") } }
        } else {
            reportRepo.findBySlug(idOrSlug)
                .orElseThrow { IllegalArgumentException("Report not found: $idOrSlug") }
        }
    }

    @Transactional(readOnly = true)
    fun getReport(id: Long): ReportResponse {
        val report = reportRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Report not found: $id") }
        return toResponse(report)
    }

    @Transactional(readOnly = true)
    fun listReports(
        status: ReportStatus? = null,
        folderId: Long? = null,
        viewerUserId: Long? = null,
        viewerRoleIds: List<Long> = emptyList(),
        pageable: Pageable = PageRequest.of(0, 20)
    ): Page<ReportListItem> {
        return if (viewerUserId != null) {
            val roleIds = viewerRoleIds.ifEmpty { listOf(-1L) }
            reportRepo.findFilteredForViewer(status, folderId, viewerUserId, roleIds, pageable)
                .map { toListItem(it) }
        } else {
            reportRepo.findFiltered(status, null, folderId, pageable)
                .map { toListItem(it) }
        }
    }

    @Transactional(readOnly = true)
    fun searchReports(
        term: String,
        viewerUserId: Long? = null,
        viewerRoleIds: List<Long> = emptyList(),
        pageable: Pageable
    ): Page<ReportListItem> {
        return if (viewerUserId != null) {
            val roleIds = viewerRoleIds.ifEmpty { listOf(-1L) }
            reportRepo.searchByNameForViewer(term, viewerUserId, roleIds, pageable)
                .map { toListItem(it) }
        } else {
            reportRepo.searchByName(term, pageable).map { toListItem(it) }
        }
    }

    @Transactional(readOnly = true)
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
    fun unpublishReport(id: Long, userId: Long): ReportResponse {
        return updateReport(id, UpdateReportRequest(status = ReportStatus.DRAFT), userId)
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
        val created = createReport(createRequest, userId)

        // Build old widget ID -> new widget ID mapping
        val sourceWidgets = widgetRepo.findByReportIdOrderBySortOrder(id)
        val newWidgets = widgetRepo.findByReportIdOrderBySortOrder(created.id)
        val widgetIdMap = mutableMapOf<Long, Long>()
        sourceWidgets.forEachIndexed { i, sw ->
            if (i < newWidgets.size) widgetIdMap[sw.id] = newWidgets[i].id
        }

        // Remap toggleWidgetIds in BUTTON widget chartConfigs
        for (nw in newWidgets) {
            if (nw.widgetType != "BUTTON") continue
            try {
                val root = objectMapper.readTree(nw.chartConfig) as? ObjectNode ?: continue
                val toggleIds = root.get("toggleWidgetIds") ?: continue
                if (!toggleIds.isArray || toggleIds.size() == 0) continue
                val remapped = objectMapper.createArrayNode()
                for (idNode in toggleIds) {
                    val newId = widgetIdMap[idNode.asLong()]
                    if (newId != null) remapped.add(newId)
                }
                root.set<ArrayNode>("toggleWidgetIds", remapped)
                nw.chartConfig = objectMapper.writeValueAsString(root)
                widgetRepo.save(nw)
            } catch (e: Exception) {
                log.warn("Failed to remap toggleWidgetIds for widget {}: {}", nw.id, e.message)
            }
        }

        // Copy containers (tabs) with remapped widget IDs
        try {
            val containers = vizService.getContainers(id)
            for (c in containers) {
                val remappedChildren = c.childWidgetIds.map { group ->
                    group.mapNotNull { widgetIdMap[it] }
                }
                vizService.createContainer(ContainerRequest(
                    reportId = created.id,
                    containerType = c.containerType,
                    name = c.name,
                    childWidgetIds = remappedChildren,
                    tabNames = c.tabNames,
                    activeTab = c.activeTab,
                    autoDistribute = c.autoDistribute,
                    config = c.config,
                    sortOrder = c.sortOrder
                ))
            }
        } catch (e: Exception) {
            log.warn("Failed to copy containers for report {}: {}", id, e.message)
        }

        // Copy dashboard actions with remapped widget IDs
        try {
            val actions = interactiveService.getActionsForReport(id)
            for (a in actions) {
                val newSourceId = a.sourceWidgetId?.let { widgetIdMap[it] }
                val newTargetIds = a.targetWidgetIds?.split(",")
                    ?.mapNotNull { it.trim().toLongOrNull()?.let { wid -> widgetIdMap[wid] } }
                    ?.joinToString(",")
                interactiveService.createAction(DashboardActionRequest(
                    reportId = created.id,
                    name = a.name,
                    actionType = a.actionType,
                    triggerType = a.triggerType,
                    sourceWidgetId = newSourceId,
                    targetWidgetIds = newTargetIds,
                    sourceField = a.sourceField,
                    targetField = a.targetField,
                    targetReportId = a.targetReportId,
                    urlTemplate = a.urlTemplate,
                    config = a.config
                ))
            }
        } catch (e: Exception) {
            log.warn("Failed to copy actions for report {}: {}", id, e.message)
        }

        // Copy parameter controls
        try {
            val controls = controlService.getParameterControls(id)
            for (c in controls) {
                controlService.saveParameterControl(ParameterControlRequest(
                    reportId = created.id,
                    parameterName = c.parameterName,
                    controlType = c.controlType,
                    datasourceId = c.datasourceId,
                    optionsQuery = c.optionsQuery,
                    sliderMin = c.sliderMin,
                    sliderMax = c.sliderMax,
                    sliderStep = c.sliderStep,
                    sortOrder = c.sortOrder
                ))
            }
        } catch (e: Exception) {
            log.warn("Failed to copy parameter controls for report {}: {}", id, e.message)
        }

        // Copy drill-down actions
        try {
            val drillActions = drillService.getActionsForReport(id)
            for ((_, actions) in drillActions) {
                for (a in actions) {
                    val newSourceId = a.sourceWidgetId.let { widgetIdMap[it] } ?: continue
                    drillService.create(DrillActionCreateRequest(
                        sourceWidgetId = newSourceId,
                        targetReportId = a.targetReportId,
                        actionType = a.actionType,
                        label = a.label,
                        paramMapping = a.paramMapping,
                        triggerType = a.triggerType,
                        openMode = a.openMode
                    ))
                }
            }
        } catch (e: Exception) {
            log.warn("Failed to copy drill actions for report {}: {}", id, e.message)
        }

        // Copy per-widget elements: annotations, tooltips, chart layers, visibility rules
        for ((oldId, newId) in widgetIdMap) {
            try {
                val annotations = vizService.getAnnotations(oldId)
                for (a in annotations) {
                    vizService.createAnnotation(AnnotationRequest(
                        widgetId = newId, annotationType = a.annotationType,
                        axis = a.axis, value = a.value, valueEnd = a.valueEnd,
                        label = a.label, color = a.color, lineStyle = a.lineStyle,
                        lineWidth = a.lineWidth, opacity = a.opacity, fillColor = a.fillColor,
                        fillOpacity = a.fillOpacity, position = a.position, fontSize = a.fontSize,
                        isVisible = a.isVisible, sortOrder = a.sortOrder, config = a.config
                    ))
                }
            } catch (_: Exception) {}

            try {
                val tooltip = vizService.getTooltipConfig(oldId)
                if (tooltip != null) {
                    vizService.saveTooltipConfig(TooltipConfigRequest(
                        widgetId = newId, isEnabled = tooltip.isEnabled, showTitle = tooltip.showTitle,
                        titleField = tooltip.titleField, fields = tooltip.fields,
                        showSparkline = tooltip.showSparkline, sparklineField = tooltip.sparklineField,
                        htmlTemplate = tooltip.htmlTemplate, config = tooltip.config
                    ))
                }
            } catch (_: Exception) {}

            try {
                val layers = interactiveService.getLayersForWidget(oldId)
                for (l in layers) {
                    interactiveService.createLayer(ChartLayerRequest(
                        widgetId = newId, name = l.name, label = l.label,
                        queryId = l.queryId, datasourceId = l.datasourceId,
                        rawSql = l.rawSql, chartType = l.chartType, axis = l.axis,
                        color = l.color, opacity = l.opacity, isVisible = l.isVisible,
                        sortOrder = l.sortOrder, seriesConfig = l.seriesConfig,
                        categoryField = l.categoryField, valueField = l.valueField
                    ))
                }
            } catch (_: Exception) {}

            try {
                val rules = interactiveService.getRulesForWidget(oldId)
                for (r in rules) {
                    interactiveService.createVisibilityRule(VisibilityRuleRequest(
                        widgetId = newId, ruleType = r.ruleType,
                        parameterName = r.parameterName, operator = r.operator,
                        expectedValue = r.expectedValue
                    ))
                }
            } catch (_: Exception) {}
        }

        // Copy overlays
        try {
            val overlays = interactiveService.getOverlaysForReport(id)
            for (o in overlays) {
                interactiveService.createOverlay(OverlayRequest(
                    reportId = created.id, overlayType = o.overlayType,
                    content = o.content, positionX = o.positionX, positionY = o.positionY,
                    width = o.width, height = o.height, zIndex = o.zIndex,
                    opacity = o.opacity, linkUrl = o.linkUrl, style = o.style
                ))
            }
        } catch (e: Exception) {
            log.warn("Failed to copy overlays for report {}: {}", id, e.message)
        }

        log.info("Duplicated report {} -> {} with all interactive elements", id, created.id)
        return created
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

        // Use direct delete + flush to avoid unique(report_id, name) conflicts
        // when replacing parameters in a single transaction.
        paramRepo.deleteByReportId(reportId)
        paramRepo.flush()

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

        request.widgetType?.let { widget.widgetType = it }
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
        id = r.id, slug = r.slug, name = r.name, description = r.description,
        reportType = r.reportType, layout = r.layout, settings = r.settings,
        status = r.status, isTemplate = r.isTemplate, thumbnailUrl = r.thumbnailUrl,
        folderId = r.folderId,
        parameters = r.parameters.map { toParamDto(it) },
        widgets = r.widgets.map { toWidgetResponse(it) },
        createdBy = r.createdBy, updatedBy = r.updatedBy,
        createdAt = r.createdAt, updatedAt = r.updatedAt
    )

    private fun toListItem(r: Report) = ReportListItem(
        id = r.id, slug = r.slug, name = r.name, description = r.description,
        reportType = r.reportType, status = r.status,
        isTemplate = r.isTemplate, widgetCount = widgetRepo.countByReportId(r.id).toInt(),
        parameterCount = paramRepo.countByReportId(r.id).toInt(),
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
