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

        // Substitute provided parent values, skip blank ones
        for ((paramName, paramVal) in parentValues) {
            if (paramVal.isNotBlank()) {
                query = query.replace(":$paramName", "'${paramVal.replace("'", "''")}'")
            }
        }
        // Remove any remaining unsubstituted :param references by dropping their AND-clause.
        // Matches patterns like: AND column = :param  /  AND column != :param  /  AND func(:param)
        // Stops at next AND, ORDER, GROUP, LIMIT, HAVING or end of string.
        val unsubstituted = Regex(":[a-zA-Z_]\\w*")
        while (unsubstituted.containsMatchIn(query)) {
            query = query.replace(
                Regex("""(?i)\s+AND\s+[^,)]*?:[a-zA-Z_]\w*[^,)]*?(?=\s+AND\s|\s+ORDER\s|\s+GROUP\s|\s+LIMIT\s|\s+HAVING\s|$)"""),
                ""
            )
            // Safety: if the regex didn't remove anything, break to avoid infinite loop
            if (unsubstituted.containsMatchIn(query)) {
                // Fallback: replace remaining :params with empty string to avoid SQL error
                query = query.replace(unsubstituted, "''")
                break
            }
        }

        val threshold = 1000
        return try {
            val result = connectionManager.executeQuery(ds, query, threshold + 1)
            val firstCol = result.columns.firstOrNull()?.name
            val allOptions = result.rows.mapNotNull { row ->
                (if (firstCol != null) row[firstCol] else null)?.toString()?.takeIf { it.isNotBlank() }
            }.distinct()
            val hasMore = allOptions.size > threshold
            ParameterOptionsResponse(
                parameterName = parameterName,
                options = if (hasMore) allOptions.take(threshold) else allOptions,
                hasMore = hasMore,
                columnName = firstCol
            )
        } catch (e: Exception) {
            log.error("Failed to load options for parameter {}: {}", parameterName, e.message)
            ParameterOptionsResponse(parameterName, emptyList())
        }
    }

    /**
     * Search options for a parameter using a case-insensitive substring match.
     * Wraps the stored optionsQuery in a subquery filtered by the given column.
     */
    fun searchParameterOptions(
        reportId: Long,
        parameterName: String,
        searchQuery: String,
        columnName: String,
        limit: Int = 50,
        parentValues: Map<String, String> = emptyMap()
    ): ParameterOptionsResponse {
        val control = paramControlRepo.findByReportIdAndParameterName(reportId, parameterName)
            ?: return ParameterOptionsResponse(parameterName, emptyList())

        if (control.optionsQuery.isNullOrBlank() || control.datasourceId == null) {
            return ParameterOptionsResponse(parameterName, emptyList())
        }

        val ds = dataSourceRepository.findById(control.datasourceId!!)
            .orElseThrow { NoSuchElementException("DataSource not found: ${control.datasourceId}") }

        // Substitute parent values in the base query before wrapping
        var baseQuery = control.optionsQuery!!
        for ((pName, pVal) in parentValues) {
            if (pVal.isNotBlank()) {
                baseQuery = baseQuery.replace(":$pName", "'${pVal.replace("'", "''")}'")
            }
        }
        // Remove AND-clauses with unsubstituted :params
        val unsubstituted = Regex(":[a-zA-Z_]\\w*")
        while (unsubstituted.containsMatchIn(baseQuery)) {
            val before = baseQuery
            baseQuery = baseQuery.replace(
                Regex("""(?i)\s+AND\s+[^,)]*?:[a-zA-Z_]\w*[^,)]*?(?=\s+AND\s|\s+ORDER\s|\s+GROUP\s|\s+LIMIT\s|\s+HAVING\s|$)"""),
                ""
            )
            if (baseQuery == before) { baseQuery = baseQuery.replace(unsubstituted, "''"); break }
        }

        // Sanitize inputs to prevent injection (column name must be a simple identifier)
        val safeCol = columnName.replace(Regex("[^A-Za-z0-9_]"), "")
        val safeSearch = searchQuery.replace("'", "''")

        val wrappedQuery = """
            SELECT $safeCol FROM ($baseQuery) AS _opts
            WHERE positionCaseInsensitive(toString($safeCol), '$safeSearch') > 0
            LIMIT $limit
        """.trimIndent()

        return try {
            val result = connectionManager.executeQuery(ds, wrappedQuery, limit)
            val firstCol = result.columns.firstOrNull()?.name
            val options = result.rows.mapNotNull { row ->
                (if (firstCol != null) row[firstCol] else null)?.toString()?.takeIf { it.isNotBlank() }
            }.distinct()
            ParameterOptionsResponse(parameterName, options, false, columnName)
        } catch (e: Exception) {
            log.error("Failed to search options for parameter {}: {}", parameterName, e.message)
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
            optionsQuery = optionsQuery, sliderMin = sliderMin,
            sliderMax = sliderMax, sliderStep = sliderStep,
            config = configMap, sortOrder = sortOrder, createdAt = createdAt
        )
    }
}
