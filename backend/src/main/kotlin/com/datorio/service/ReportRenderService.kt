package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * Server-side report rendering engine.
 *
 * For each widget in a report:
 * 1. Resolve the data source (from widget or saved query)
 * 2. Map report parameters → query parameters
 * 3. Execute the query via SavedQueryService
 * 4. Return data alongside chart/table config for the frontend to render
 */
@Service
class ReportRenderService(
    private val reportRepo: ReportRepository,
    private val widgetRepo: ReportWidgetRepository,
    private val savedQueryService: SavedQueryService,
    private val snapshotRepo: ReportSnapshotRepository,
    private val objectMapper: ObjectMapper,
    private val liveDataService: LiveDataService
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Render a full report: execute all visible widget queries and return data.
     */
    @Transactional(readOnly = true)
    fun renderReport(reportId: Long, request: RenderReportRequest, username: String): RenderReportResponse {
        val startMs = System.currentTimeMillis()

        val report = reportRepo.findById(reportId)
            .orElseThrow { IllegalArgumentException("Report not found: $reportId") }

        // Merge provided parameters with defaults
        val resolvedParams = resolveParameters(report, request.parameters)

        // Execute each visible widget
        val widgets = widgetRepo.findByReportIdOrderBySortOrder(reportId)
        val renderedWidgets = widgets
            .filter { it.isVisible }
            .map { widget -> renderWidget(widget, resolvedParams, username) }

        val totalMs = System.currentTimeMillis() - startMs
        log.info("Rendered report '{}' (id={}) with {} widgets in {}ms",
            report.name, reportId, renderedWidgets.size, totalMs)

        val response = RenderReportResponse(
            reportId = report.id,
            reportName = report.name,
            parameters = resolvedParams,
            widgets = renderedWidgets,
            executionMs = totalMs
        )

        // Push to live subscribers
        try { liveDataService.notifyReportUpdate(reportId, response) } catch (_: Exception) {}

        return response
    }

    /**
     * Render and save a snapshot (for scheduling or manual snapshots).
     */
    @Transactional
    fun renderAndSnapshot(reportId: Long, params: Map<String, Any?>, username: String,
                          scheduleId: Long? = null, outputFormat: OutputFormat = OutputFormat.JSON): ReportSnapshot {
        val startMs = System.currentTimeMillis()

        return try {
            val renderResult = renderReport(reportId, RenderReportRequest(params), username)

            val snapshot = ReportSnapshot(
                reportId = reportId,
                scheduleId = scheduleId,
                parameters = objectMapper.writeValueAsString(params),
                resultData = objectMapper.writeValueAsString(renderResult),
                outputFormat = outputFormat,
                status = "SUCCESS",
                executionMs = System.currentTimeMillis() - startMs,
                createdBy = null
            )
            snapshotRepo.save(snapshot)
        } catch (e: Exception) {
            log.error("Failed to render report {} for snapshot: {}", reportId, e.message)
            val snapshot = ReportSnapshot(
                reportId = reportId,
                scheduleId = scheduleId,
                parameters = objectMapper.writeValueAsString(params),
                outputFormat = outputFormat,
                status = "ERROR",
                executionMs = System.currentTimeMillis() - startMs,
                errorMessage = e.message,
                createdBy = null
            )
            snapshotRepo.save(snapshot)
        }
    }

    /**
     * Get the latest snapshot for a report.
     */
    fun getLatestSnapshot(reportId: Long): SnapshotResponse? {
        val page = snapshotRepo.findLatestByReportId(reportId, PageRequest.of(0, 1))
        return page.content.firstOrNull()?.let { toSnapshotResponse(it) }
    }

    /**
     * List snapshots for a report.
     */
    fun listSnapshots(reportId: Long, page: Int = 0, size: Int = 20): List<SnapshotResponse> {
        return snapshotRepo.findByReportIdOrderByCreatedAtDesc(reportId, PageRequest.of(page, size))
            .content.map { toSnapshotResponse(it) }
    }

    // ── Internal helpers ──

    private fun resolveParameters(report: Report, provided: Map<String, Any?>): Map<String, Any?> {
        val resolved = mutableMapOf<String, Any?>()

        for (param in report.parameters) {
            val value = provided[param.name]
            if (value != null) {
                resolved[param.name] = value
            } else if (param.defaultValue != null) {
                resolved[param.name] = param.defaultValue
            } else if (param.isRequired) {
                throw IllegalArgumentException("Missing required parameter: '${param.name}'")
            }
        }

        // Pass through any extra params not defined in the report
        for ((key, value) in provided) {
            if (key !in resolved) {
                resolved[key] = value
            }
        }

        return resolved
    }

    private fun renderWidget(widget: ReportWidget, reportParams: Map<String, Any?>, username: String): RenderedWidget {
        return try {
            val widgetParams = mapWidgetParams(widget, reportParams)
            val data = executeWidgetQuery(widget, widgetParams, username)

            RenderedWidget(
                widgetId = widget.id,
                widgetType = widget.widgetType,
                title = widget.title,
                chartConfig = widget.chartConfig,
                position = widget.position,
                style = widget.style,
                data = data
            )
        } catch (e: Exception) {
            log.warn("Widget {} (id={}) failed: {}", widget.title ?: widget.widgetType, widget.id, e.message)
            RenderedWidget(
                widgetId = widget.id,
                widgetType = widget.widgetType,
                title = widget.title,
                chartConfig = widget.chartConfig,
                position = widget.position,
                style = widget.style,
                data = null,
                error = e.message
            )
        }
    }

    /**
     * Map report-level parameters to widget-level parameters using the
     * widget's paramMapping configuration.
     *
     * paramMapping is a JSON like: {"dateFrom": "reportStartDate", "dateTo": "reportEndDate"}
     * where keys are query parameter names and values are report parameter names.
     */
    private fun mapWidgetParams(widget: ReportWidget, reportParams: Map<String, Any?>): Map<String, Any?> {
        val mapping: Map<String, String> = try {
            if (widget.paramMapping == "{}") emptyMap()
            else objectMapper.readValue(widget.paramMapping)
        } catch (e: Exception) {
            emptyMap()
        }

        if (mapping.isEmpty()) return reportParams

        val result = mutableMapOf<String, Any?>()
        for ((queryParam, reportParam) in mapping) {
            if (reportParams.containsKey(reportParam)) {
                result[queryParam] = reportParams[reportParam]
            }
        }
        // Also include unmapped report params
        for ((key, value) in reportParams) {
            if (key !in result) {
                result[key] = value
            }
        }
        return result
    }

    /**
     * Execute the query associated with a widget.
     * Priority: queryId > rawSql > null (TEXT/IMAGE widgets have no data)
     */
    private fun executeWidgetQuery(widget: ReportWidget, params: Map<String, Any?>, username: String): WidgetData? {
        // Non-data widgets
        if (widget.widgetType in listOf(WidgetType.TEXT, WidgetType.IMAGE)) {
            return null
        }

        val startMs = System.currentTimeMillis()

        when {
            // Widget bound to a saved query
            widget.queryId != null -> {
                val result = savedQueryService.executeSavedQuery(
                    queryId = widget.queryId!!,
                    parameters = params,
                    username = username,
                    ipAddress = "system"
                )
                return WidgetData(
                    columns = result.columns.map { it.name },
                    rows = result.rows,
                    rowCount = result.rowCount,
                    executionMs = System.currentTimeMillis() - startMs
                )
            }

            // Widget with inline SQL
            widget.rawSql != null && widget.datasourceId != null -> {
                val request = QueryExecuteRequest(
                    datasourceId = widget.datasourceId!!,
                    sql = widget.rawSql!!,
                    parameters = params,
                    limit = 10000
                )
                val result = savedQueryService.executeAdHocQuery(
                    request = request,
                    username = username,
                    ipAddress = "system"
                )
                return WidgetData(
                    columns = result.columns.map { it.name },
                    rows = result.rows,
                    rowCount = result.rowCount,
                    executionMs = System.currentTimeMillis() - startMs
                )
            }

            // KPI/FILTER widgets might not have queries yet
            else -> return null
        }
    }

    private fun toSnapshotResponse(s: ReportSnapshot) = SnapshotResponse(
        id = s.id, reportId = s.reportId, scheduleId = s.scheduleId,
        parameters = s.parameters, outputFormat = s.outputFormat,
        status = s.status, executionMs = s.executionMs,
        errorMessage = s.errorMessage, createdBy = s.createdBy,
        createdAt = s.createdAt
    )
}
