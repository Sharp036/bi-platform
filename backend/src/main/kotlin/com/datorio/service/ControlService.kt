package com.datorio.service

import com.datorio.datasource.ConnectionManager
import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ControlService(
    private val filterConfigRepo: GlobalFilterConfigRepository,
    private val paramControlRepo: ParameterControlRepository,
    private val dataSourceRepository: DataSourceRepository,
    private val connectionManager: ConnectionManager,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ═══════════════════════════════════════════
    //  Global Filter Config
    // ═══════════════════════════════════════════

    fun getFiltersForReport(reportId: Long): List<GlobalFilterConfigResponse> =
        filterConfigRepo.findByReportId(reportId).map { it.toResponse() }

    fun getActiveFilters(reportId: Long): List<GlobalFilterConfigResponse> =
        filterConfigRepo.findByReportIdAndIsEnabledTrue(reportId).map { it.toResponse() }

    fun getFilterSources(reportId: Long): List<GlobalFilterConfigResponse> =
        filterConfigRepo.findByReportIdAndIsFilterSourceTrue(reportId).map { it.toResponse() }

    @Transactional
    fun saveFilterConfig(request: GlobalFilterConfigRequest): GlobalFilterConfigResponse {
        val existing = filterConfigRepo.findByReportIdAndWidgetId(request.reportId, request.widgetId)
        val config = if (existing != null) {
            existing.isFilterSource = request.isFilterSource
            existing.filterField = request.filterField
            existing.excludedTargets = request.excludedTargets
            existing.isEnabled = request.isEnabled
            existing
        } else {
            GlobalFilterConfig(
                reportId = request.reportId,
                widgetId = request.widgetId,
                isFilterSource = request.isFilterSource,
                filterField = request.filterField,
                excludedTargets = request.excludedTargets,
                isEnabled = request.isEnabled
            )
        }
        return filterConfigRepo.save(config).toResponse()
    }

    @Transactional
    fun deleteFilterConfig(reportId: Long, widgetId: Long) {
        filterConfigRepo.deleteByReportIdAndWidgetId(reportId, widgetId)
    }

    /**
     * Resolve which target widgets should be filtered when a source widget triggers.
     * Returns widget IDs that should receive the filter, excluding those in the exclude-list.
     */
    fun resolveFilterTargets(reportId: Long, sourceWidgetId: Long, allWidgetIds: List<Long>): List<Long> {
        val config = filterConfigRepo.findByReportIdAndWidgetId(reportId, sourceWidgetId)
            ?: return emptyList()

        if (!config.isFilterSource || !config.isEnabled) return emptyList()

        val excluded = config.excludedTargets?.split(",")
            ?.mapNotNull { it.trim().toLongOrNull() }?.toSet() ?: emptySet()

        return allWidgetIds.filter { it != sourceWidgetId && it !in excluded }
    }

    // ═══════════════════════════════════════════
    //  Parameter Controls
    // ═══════════════════════════════════════════

    fun getParameterControls(reportId: Long): List<ParameterControlResponse> =
        paramControlRepo.findByReportIdOrderBySortOrder(reportId).map { it.toResponse() }

    @Transactional
    fun saveParameterControl(request: ParameterControlRequest): ParameterControlResponse {
        val existing = paramControlRepo.findByReportIdAndParameterName(request.reportId, request.parameterName)
        val control = if (existing != null) {
            existing.controlType = request.controlType
            existing.datasourceId = request.datasourceId
            existing.optionsQuery = request.optionsQuery
            existing.cascadeParent = request.cascadeParent
            existing.cascadeField = request.cascadeField
            existing.sliderMin = request.sliderMin
            existing.sliderMax = request.sliderMax
            existing.sliderStep = request.sliderStep
            existing.config = objectMapper.writeValueAsString(request.config)
            existing.sortOrder = request.sortOrder
            existing
        } else {
            ParameterControl(
                reportId = request.reportId,
                parameterName = request.parameterName,
                controlType = request.controlType,
                datasourceId = request.datasourceId,
                optionsQuery = request.optionsQuery,
                cascadeParent = request.cascadeParent,
                cascadeField = request.cascadeField,
                sliderMin = request.sliderMin,
                sliderMax = request.sliderMax,
                sliderStep = request.sliderStep,
                config = objectMapper.writeValueAsString(request.config),
                sortOrder = request.sortOrder
            )
        }
        return paramControlRepo.save(control).toResponse()
    }

    @Transactional
    fun deleteParameterControl(reportId: Long, parameterName: String) {
        paramControlRepo.deleteByReportIdAndParameterName(reportId, parameterName)
    }

    /**
     * Load dynamic options for a parameter (data-driven dropdown).
     * Executes the optionsQuery against the datasource.
     */
    fun loadParameterOptions(
        reportId: Long,
        parameterName: String,
        parentValues: Map<String, String> = emptyMap()
    ): ParameterOptionsResponse {
        val control = paramControlRepo.findByReportIdAndParameterName(reportId, parameterName)
            ?: return ParameterOptionsResponse(parameterName, emptyList())

        if (control.optionsQuery.isNullOrBlank() || control.datasourceId == null) {
            return ParameterOptionsResponse(parameterName, emptyList())
        }

        val ds = dataSourceRepository.findById(control.datasourceId!!)
            .orElseThrow { NoSuchElementException("DataSource not found: ${control.datasourceId}") }

        var query = control.optionsQuery!!

        // Substitute cascade parent values
        if (!control.cascadeParent.isNullOrBlank()) {
            val parentVal = parentValues[control.cascadeParent!!] ?: ""
            query = query.replace(":${control.cascadeParent}", "'${parentVal.replace("'", "''")}'")
        }

        return try {
            val result = connectionManager.executeQuery(ds, query, 500)
            val firstCol = result.columns.firstOrNull()?.name
            val options = result.rows.map { row ->
                (if (firstCol != null) row[firstCol] else null)?.toString() ?: ""
            }.filter { it.isNotBlank() }.distinct()
            ParameterOptionsResponse(parameterName, options)
        } catch (e: Exception) {
            log.error("Failed to load options for parameter {}: {}", parameterName, e.message)
            ParameterOptionsResponse(parameterName, emptyList())
        }
    }

    // ═══════════════════════════════════════════
    //  Mappers
    // ═══════════════════════════════════════════

    private fun GlobalFilterConfig.toResponse() = GlobalFilterConfigResponse(
        id = id, reportId = reportId, widgetId = widgetId,
        isFilterSource = isFilterSource, filterField = filterField,
        excludedTargets = excludedTargets, isEnabled = isEnabled,
        createdAt = createdAt
    )

    private fun ParameterControl.toResponse(): ParameterControlResponse {
        val configMap: Map<String, Any?> = try {
            objectMapper.readValue(config)
        } catch (_: Exception) { emptyMap() }
        return ParameterControlResponse(
            id = id, reportId = reportId, parameterName = parameterName,
            controlType = controlType, datasourceId = datasourceId,
            optionsQuery = optionsQuery, cascadeParent = cascadeParent,
            cascadeField = cascadeField, sliderMin = sliderMin,
            sliderMax = sliderMax, sliderStep = sliderStep,
            config = configMap, sortOrder = sortOrder, createdAt = createdAt
        )
    }
}
