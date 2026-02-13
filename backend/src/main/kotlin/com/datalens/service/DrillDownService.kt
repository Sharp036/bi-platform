package com.datalens.service

import com.datalens.model.*
import com.datalens.model.dto.*
import com.datalens.repository.DrillActionRepository
import com.datalens.repository.ReportRepository
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class DrillDownService(
    private val drillRepo: DrillActionRepository,
    private val reportRepo: ReportRepository,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ── CRUD ──

    @Transactional
    fun create(request: DrillActionCreateRequest): DrillActionResponse {
        // Validate target report exists
        val targetReport = reportRepo.findById(request.targetReportId)
            .orElseThrow { IllegalArgumentException("Target report not found: ${request.targetReportId}") }

        val action = DrillAction(
            sourceWidgetId = request.sourceWidgetId,
            targetReportId = request.targetReportId,
            actionType = request.actionType,
            label = request.label,
            description = request.description,
            paramMapping = objectMapper.writeValueAsString(request.paramMapping),
            triggerType = request.triggerType,
            openMode = request.openMode,
            sortOrder = request.sortOrder,
            config = objectMapper.writeValueAsString(request.config)
        )
        val saved = drillRepo.save(action)
        return toResponse(saved, targetReport.name)
    }

    @Transactional
    fun update(id: Long, request: DrillActionUpdateRequest): DrillActionResponse {
        val action = drillRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Drill action not found: $id") }

        request.targetReportId?.let { newTarget ->
            reportRepo.findById(newTarget)
                .orElseThrow { IllegalArgumentException("Target report not found: $newTarget") }
            action.targetReportId = newTarget
        }
        request.actionType?.let { action.actionType = it }
        request.label?.let { action.label = it }
        request.description?.let { action.description = it }
        request.paramMapping?.let { action.paramMapping = objectMapper.writeValueAsString(it) }
        request.triggerType?.let { action.triggerType = it }
        request.openMode?.let { action.openMode = it }
        request.isActive?.let { action.isActive = it }
        request.sortOrder?.let { action.sortOrder = it }
        request.config?.let { action.config = objectMapper.writeValueAsString(it) }
        action.updatedAt = Instant.now()

        val saved = drillRepo.save(action)
        val targetName = reportRepo.findById(saved.targetReportId).map { it.name }.orElse(null)
        return toResponse(saved, targetName)
    }

    fun getById(id: Long): DrillActionResponse {
        val action = drillRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Drill action not found: $id") }
        val targetName = reportRepo.findById(action.targetReportId).map { it.name }.orElse(null)
        return toResponse(action, targetName)
    }

    /**
     * Get all drill actions for a widget.
     */
    fun getActionsForWidget(widgetId: Long): List<DrillActionResponse> {
        return drillRepo.findBySourceWidgetIdAndIsActiveTrueOrderBySortOrder(widgetId).map { action ->
            val targetName = reportRepo.findById(action.targetReportId).map { it.name }.orElse(null)
            toResponse(action, targetName)
        }
    }

    /**
     * Get all drill actions for all widgets in a report (batch).
     */
    fun getActionsForReport(reportId: Long): Map<Long, List<DrillActionResponse>> {
        val report = reportRepo.findById(reportId)
            .orElseThrow { IllegalArgumentException("Report not found: $reportId") }

        val widgetIds = report.widgets.map { it.id }
        if (widgetIds.isEmpty()) return emptyMap()

        val actions = drillRepo.findBySourceWidgetIdIn(widgetIds)
        if (actions.isEmpty()) return emptyMap()

        // Batch load target report names
        val targetIds = actions.map { it.targetReportId }.distinct()
        val reportNames = reportRepo.findAllById(targetIds).associate { it.id to it.name }

        return actions
            .filter { it.isActive }
            .groupBy { it.sourceWidgetId }
            .mapValues { (_, acts) ->
                acts.sortedBy { it.sortOrder }.map { toResponse(it, reportNames[it.targetReportId]) }
            }
    }

    @Transactional
    fun delete(id: Long) {
        if (!drillRepo.existsById(id)) {
            throw IllegalArgumentException("Drill action not found: $id")
        }
        drillRepo.deleteById(id)
    }

    // ── Navigation Resolution ──

    /**
     * Resolve a drill navigation: given clicked data, compute target parameters.
     */
    fun resolveNavigation(request: DrillNavigateRequest): DrillNavigateResponse {
        val action = drillRepo.findById(request.actionId)
            .orElseThrow { IllegalArgumentException("Drill action not found: ${request.actionId}") }

        val targetReport = reportRepo.findById(action.targetReportId)
            .orElseThrow { IllegalArgumentException("Target report not found: ${action.targetReportId}") }

        val mapping: Map<String, ParamMappingEntry> = try {
            objectMapper.readValue(action.paramMapping)
        } catch (e: Exception) {
            log.warn("Failed to parse param mapping for action {}: {}", action.id, e.message)
            emptyMap()
        }

        // Resolve parameters from clicked data
        val resolvedParams = mutableMapOf<String, Any?>()

        for ((targetParam, entry) in mapping) {
            val resolvedValue: Any? = when (entry.source) {
                "column" -> request.clickedData[entry.value]
                "series" -> request.clickedData["seriesName"] ?: request.clickedData[entry.value]
                "category" -> request.clickedData["name"] ?: request.clickedData["category"]
                "value" -> request.clickedData["value"] ?: request.clickedData[entry.value]
                "fixed" -> entry.value
                "current_param" -> request.currentParameters[entry.value]
                else -> request.clickedData[entry.value]
            }
            resolvedParams[targetParam] = resolvedValue
        }

        // Also carry forward any current parameters not overridden
        for ((key, value) in request.currentParameters) {
            if (key !in resolvedParams) {
                resolvedParams[key] = value
            }
        }

        val breadcrumbLabel = action.label
            ?: resolvedParams.values.firstOrNull()?.toString()
            ?: targetReport.name

        log.info("Drill navigation: action={} → report='{}', params={}",
            action.id, targetReport.name, resolvedParams)

        return DrillNavigateResponse(
            targetReportId = targetReport.id,
            targetReportName = targetReport.name,
            resolvedParameters = resolvedParams,
            openMode = action.openMode,
            breadcrumbLabel = breadcrumbLabel
        )
    }

    // ── Mapper ──

    private fun toResponse(a: DrillAction, targetReportName: String?): DrillActionResponse {
        val mapping: Map<String, ParamMappingEntry> = try {
            objectMapper.readValue(a.paramMapping)
        } catch (_: Exception) { emptyMap() }

        val config: Map<String, Any?> = try {
            objectMapper.readValue(a.config)
        } catch (_: Exception) { emptyMap() }

        return DrillActionResponse(
            id = a.id,
            sourceWidgetId = a.sourceWidgetId,
            targetReportId = a.targetReportId,
            targetReportName = targetReportName,
            actionType = a.actionType,
            label = a.label,
            description = a.description,
            paramMapping = mapping,
            triggerType = a.triggerType,
            openMode = a.openMode,
            isActive = a.isActive,
            sortOrder = a.sortOrder,
            config = config,
            createdAt = a.createdAt,
            updatedAt = a.updatedAt
        )
    }
}
