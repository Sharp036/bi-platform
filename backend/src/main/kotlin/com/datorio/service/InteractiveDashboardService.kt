package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class InteractiveDashboardService(
    private val layerRepo: ChartLayerRepository,
    private val actionRepo: DashboardActionRepository,
    private val visibilityRepo: VisibilityRuleRepository,
    private val overlayRepo: DashboardOverlayRepository,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ════════════════════════════════════════════
    //  Chart Layers
    // ════════════════════════════════════════════

    @Transactional
    fun createLayer(req: ChartLayerRequest): ChartLayerResponse {
        val layer = ChartLayer(
            widgetId = req.widgetId, name = req.name, label = req.label,
            queryId = req.queryId, datasourceId = req.datasourceId, rawSql = req.rawSql,
            chartType = req.chartType, axis = req.axis, color = req.color,
            opacity = req.opacity, isVisible = req.isVisible, sortOrder = req.sortOrder,
            seriesConfig = objectMapper.writeValueAsString(req.seriesConfig),
            categoryField = req.categoryField, valueField = req.valueField,
            paramMapping = objectMapper.writeValueAsString(req.paramMapping)
        )
        return toLayerResponse(layerRepo.save(layer))
    }

    @Transactional
    fun updateLayer(id: Long, req: ChartLayerRequest): ChartLayerResponse {
        val layer = layerRepo.findById(id).orElseThrow { IllegalArgumentException("Layer not found: $id") }
        layer.name = req.name; layer.label = req.label
        layer.queryId = req.queryId; layer.datasourceId = req.datasourceId; layer.rawSql = req.rawSql
        layer.chartType = req.chartType; layer.axis = req.axis; layer.color = req.color
        layer.opacity = req.opacity; layer.isVisible = req.isVisible; layer.sortOrder = req.sortOrder
        layer.seriesConfig = objectMapper.writeValueAsString(req.seriesConfig)
        layer.categoryField = req.categoryField; layer.valueField = req.valueField
        return toLayerResponse(layerRepo.save(layer))
    }

    fun getLayersForWidget(widgetId: Long): List<ChartLayerResponse> =
        layerRepo.findByWidgetIdOrderBySortOrder(widgetId).map { toLayerResponse(it) }

    fun getLayersForWidgets(widgetIds: List<Long>): Map<Long, List<ChartLayerResponse>> =
        widgetIds.associateWith { getLayersForWidget(it) }.filterValues { it.isNotEmpty() }

    @Transactional
    fun deleteLayer(id: Long) { layerRepo.deleteById(id) }

    // ════════════════════════════════════════════
    //  Dashboard Actions
    // ════════════════════════════════════════════

    @Transactional
    fun createAction(req: DashboardActionRequest): DashboardActionResponse {
        val action = DashboardAction(
            reportId = req.reportId, name = req.name,
            actionType = req.actionType, triggerType = req.triggerType,
            sourceWidgetId = req.sourceWidgetId, targetWidgetIds = req.targetWidgetIds,
            sourceField = req.sourceField, targetField = req.targetField,
            targetReportId = req.targetReportId, urlTemplate = req.urlTemplate,
            config = objectMapper.writeValueAsString(req.config)
        )
        return toActionResponse(actionRepo.save(action))
    }

    @Transactional
    fun updateAction(id: Long, req: DashboardActionRequest): DashboardActionResponse {
        val action = actionRepo.findById(id).orElseThrow { IllegalArgumentException("Action not found: $id") }
        action.name = req.name; action.actionType = req.actionType; action.triggerType = req.triggerType
        action.sourceWidgetId = req.sourceWidgetId; action.targetWidgetIds = req.targetWidgetIds
        action.sourceField = req.sourceField; action.targetField = req.targetField
        action.targetReportId = req.targetReportId; action.urlTemplate = req.urlTemplate
        action.config = objectMapper.writeValueAsString(req.config)
        return toActionResponse(actionRepo.save(action))
    }

    fun getActionsForReport(reportId: Long): List<DashboardActionResponse> =
        actionRepo.findByReportIdOrderBySortOrder(reportId).map { toActionResponse(it) }

    fun getActiveActionsForReport(reportId: Long): List<DashboardActionResponse> =
        actionRepo.findByReportIdAndIsActiveTrueOrderBySortOrder(reportId).map { toActionResponse(it) }

    @Transactional
    fun deleteAction(id: Long) { actionRepo.deleteById(id) }

    // ════════════════════════════════════════════
    //  Visibility Rules
    // ════════════════════════════════════════════

    @Transactional
    fun createVisibilityRule(req: VisibilityRuleRequest): VisibilityRuleResponse {
        val rule = VisibilityRule(
            widgetId = req.widgetId, ruleType = req.ruleType,
            parameterName = req.parameterName, operator = req.operator,
            expectedValue = req.expectedValue
        )
        return toRuleResponse(visibilityRepo.save(rule))
    }

    @Transactional
    fun updateVisibilityRule(id: Long, req: VisibilityRuleRequest): VisibilityRuleResponse {
        val rule = visibilityRepo.findById(id).orElseThrow { IllegalArgumentException("Rule not found: $id") }
        rule.ruleType = req.ruleType; rule.parameterName = req.parameterName
        rule.operator = req.operator; rule.expectedValue = req.expectedValue
        return toRuleResponse(visibilityRepo.save(rule))
    }

    fun getRulesForWidget(widgetId: Long): List<VisibilityRuleResponse> =
        visibilityRepo.findByWidgetId(widgetId).map { toRuleResponse(it) }

    fun getRulesForWidgets(widgetIds: List<Long>): Map<Long, List<VisibilityRuleResponse>> =
        widgetIds.associateWith { getRulesForWidget(it) }.filterValues { it.isNotEmpty() }

    @Transactional
    fun deleteVisibilityRule(id: Long) { visibilityRepo.deleteById(id) }

    /**
     * Evaluate visibility of a widget given current parameters.
     */
    fun evaluateVisibility(widgetId: Long, parameters: Map<String, Any?>): Boolean {
        val rules = visibilityRepo.findByWidgetIdAndIsActiveTrue(widgetId)
        if (rules.isEmpty()) return true // No rules = always visible

        // All rules must pass (AND logic)
        return rules.all { rule ->
            when (rule.ruleType) {
                "PARAMETER" -> evaluateParameterRule(rule, parameters)
                "ALWAYS_HIDDEN" -> false
                "ROLE" -> true // TODO: check user roles
                else -> true
            }
        }
    }

    private fun evaluateParameterRule(rule: VisibilityRule, params: Map<String, Any?>): Boolean {
        val paramValue = params[rule.parameterName]?.toString()
        val expected = rule.expectedValue

        return when (rule.operator) {
            "EQ" -> paramValue == expected
            "NEQ" -> paramValue != expected
            "GT" -> (paramValue?.toDoubleOrNull() ?: 0.0) > (expected?.toDoubleOrNull() ?: 0.0)
            "LT" -> (paramValue?.toDoubleOrNull() ?: 0.0) < (expected?.toDoubleOrNull() ?: 0.0)
            "IN" -> expected?.split(",")?.map { it.trim() }?.contains(paramValue) ?: false
            "NOT_IN" -> !(expected?.split(",")?.map { it.trim() }?.contains(paramValue) ?: true)
            "IS_SET" -> paramValue != null && paramValue.isNotBlank()
            "IS_NOT_SET" -> paramValue == null || paramValue.isBlank()
            else -> true
        }
    }

    // ════════════════════════════════════════════
    //  Dashboard Overlays
    // ════════════════════════════════════════════

    @Transactional
    fun createOverlay(req: OverlayRequest): OverlayResponse {
        val overlay = DashboardOverlay(
            reportId = req.reportId, overlayType = req.overlayType, content = req.content,
            positionX = req.positionX, positionY = req.positionY,
            width = req.width, height = req.height,
            opacity = req.opacity, zIndex = req.zIndex, linkUrl = req.linkUrl,
            isVisible = req.isVisible, style = objectMapper.writeValueAsString(req.style)
        )
        return toOverlayResponse(overlayRepo.save(overlay))
    }

    @Transactional
    fun updateOverlay(id: Long, req: OverlayRequest): OverlayResponse {
        val overlay = overlayRepo.findById(id).orElseThrow { IllegalArgumentException("Overlay not found: $id") }
        overlay.overlayType = req.overlayType; overlay.content = req.content
        overlay.positionX = req.positionX; overlay.positionY = req.positionY
        overlay.width = req.width; overlay.height = req.height
        overlay.opacity = req.opacity; overlay.zIndex = req.zIndex
        overlay.linkUrl = req.linkUrl; overlay.isVisible = req.isVisible
        overlay.style = objectMapper.writeValueAsString(req.style)
        return toOverlayResponse(overlayRepo.save(overlay))
    }

    fun getOverlaysForReport(reportId: Long): List<OverlayResponse> =
        overlayRepo.findByReportIdOrderByZIndex(reportId).map { toOverlayResponse(it) }

    fun getVisibleOverlays(reportId: Long): List<OverlayResponse> =
        overlayRepo.findByReportIdAndIsVisibleTrueOrderByZIndex(reportId).map { toOverlayResponse(it) }

    @Transactional
    fun deleteOverlay(id: Long) { overlayRepo.deleteById(id) }

    // ════════════════════════════════════════════
    //  Full interactive metadata for a report
    // ════════════════════════════════════════════

    fun getInteractiveMeta(reportId: Long, widgetIds: List<Long>): InteractiveReportMeta {
        return InteractiveReportMeta(
            actions = getActiveActionsForReport(reportId),
            visibilityRules = getRulesForWidgets(widgetIds),
            overlays = getVisibleOverlays(reportId),
            chartLayers = getLayersForWidgets(widgetIds)
        )
    }

    // ── Mappers ──

    private fun toLayerResponse(l: ChartLayer) = ChartLayerResponse(
        id = l.id, widgetId = l.widgetId, name = l.name, label = l.label,
        queryId = l.queryId, datasourceId = l.datasourceId, rawSql = l.rawSql,
        chartType = l.chartType, axis = l.axis, color = l.color,
        opacity = l.opacity, isVisible = l.isVisible, sortOrder = l.sortOrder,
        seriesConfig = parseJson(l.seriesConfig), categoryField = l.categoryField,
        valueField = l.valueField, createdAt = l.createdAt
    )

    private fun toActionResponse(a: DashboardAction) = DashboardActionResponse(
        id = a.id, reportId = a.reportId, name = a.name,
        actionType = a.actionType, triggerType = a.triggerType,
        sourceWidgetId = a.sourceWidgetId, targetWidgetIds = a.targetWidgetIds,
        sourceField = a.sourceField, targetField = a.targetField,
        targetReportId = a.targetReportId, urlTemplate = a.urlTemplate,
        isActive = a.isActive, sortOrder = a.sortOrder,
        config = parseJson(a.config), createdAt = a.createdAt
    )

    private fun toRuleResponse(r: VisibilityRule) = VisibilityRuleResponse(
        id = r.id, widgetId = r.widgetId, ruleType = r.ruleType,
        parameterName = r.parameterName, operator = r.operator,
        expectedValue = r.expectedValue, isActive = r.isActive, createdAt = r.createdAt
    )

    private fun toOverlayResponse(o: DashboardOverlay) = OverlayResponse(
        id = o.id, reportId = o.reportId, overlayType = o.overlayType,
        content = o.content, positionX = o.positionX, positionY = o.positionY,
        width = o.width, height = o.height, opacity = o.opacity, zIndex = o.zIndex,
        linkUrl = o.linkUrl, isVisible = o.isVisible,
        style = parseJson(o.style), createdAt = o.createdAt
    )

    private fun parseJson(raw: String): Map<String, Any?> = try {
        objectMapper.readValue(raw)
    } catch (_: Exception) { emptyMap() }
}
