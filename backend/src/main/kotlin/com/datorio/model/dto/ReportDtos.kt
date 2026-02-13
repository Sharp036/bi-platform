package com.datorio.model.dto

import com.datorio.model.*
import java.time.Instant

// ═══════════════════════════════════════════════
//  Report DTOs
// ═══════════════════════════════════════════════

data class CreateReportRequest(
    val name: String,
    val description: String? = null,
    val reportType: ReportType = ReportType.STANDARD,
    val layout: String = "{}",
    val settings: String = "{}",
    val isTemplate: Boolean = false,
    val folderId: Long? = null,
    val parameters: List<ReportParameterDto> = emptyList(),
    val widgets: List<CreateWidgetRequest> = emptyList()
)

data class UpdateReportRequest(
    val name: String? = null,
    val description: String? = null,
    val layout: String? = null,
    val settings: String? = null,
    val status: ReportStatus? = null,
    val isTemplate: Boolean? = null,
    val folderId: Long? = null
)

data class ReportResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val reportType: ReportType,
    val layout: String,
    val settings: String,
    val status: ReportStatus,
    val isTemplate: Boolean,
    val thumbnailUrl: String?,
    val folderId: Long?,
    val parameters: List<ReportParameterDto>,
    val widgets: List<WidgetResponse>,
    val createdBy: Long?,
    val updatedBy: Long?,
    val createdAt: Instant,
    val updatedAt: Instant
)

data class ReportListItem(
    val id: Long,
    val name: String,
    val description: String?,
    val reportType: ReportType,
    val status: ReportStatus,
    val isTemplate: Boolean,
    val widgetCount: Int,
    val createdBy: Long?,
    val createdAt: Instant,
    val updatedAt: Instant
)

// ═══════════════════════════════════════════════
//  Parameter DTOs
// ═══════════════════════════════════════════════

data class ReportParameterDto(
    val id: Long? = null,
    val name: String,
    val label: String? = null,
    val paramType: ParamType,
    val defaultValue: String? = null,
    val isRequired: Boolean = true,
    val sortOrder: Int = 0,
    val config: String = "{}"
)

// ═══════════════════════════════════════════════
//  Widget DTOs
// ═══════════════════════════════════════════════

data class CreateWidgetRequest(
    val widgetType: WidgetType,
    val title: String? = null,
    val queryId: Long? = null,
    val datasourceId: Long? = null,
    val rawSql: String? = null,
    val chartConfig: String = "{}",
    val position: String = "{}",
    val style: String = "{}",
    val paramMapping: String = "{}",
    val sortOrder: Int = 0,
    val isVisible: Boolean = true
)

data class UpdateWidgetRequest(
    val title: String? = null,
    val queryId: Long? = null,
    val datasourceId: Long? = null,
    val rawSql: String? = null,
    val chartConfig: String? = null,
    val position: String? = null,
    val style: String? = null,
    val paramMapping: String? = null,
    val sortOrder: Int? = null,
    val isVisible: Boolean? = null
)

data class WidgetResponse(
    val id: Long,
    val widgetType: WidgetType,
    val title: String?,
    val queryId: Long?,
    val datasourceId: Long?,
    val rawSql: String?,
    val chartConfig: String,
    val position: String,
    val style: String,
    val paramMapping: String,
    val sortOrder: Int,
    val isVisible: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant
)

// ═══════════════════════════════════════════════
//  Report Render — server-side data resolution
// ═══════════════════════════════════════════════

data class RenderReportRequest(
    val parameters: Map<String, Any?> = emptyMap()
)

data class RenderReportResponse(
    val reportId: Long,
    val reportName: String,
    val parameters: Map<String, Any?>,
    val widgets: List<RenderedWidget>,
    val executionMs: Long
)

data class RenderedWidget(
    val widgetId: Long,
    val widgetType: WidgetType,
    val title: String?,
    val chartConfig: String,
    val position: String,
    val style: String,
    val data: WidgetData?,
    val error: String? = null
)

data class WidgetData(
    val columns: List<String>,
    val rows: List<List<Any?>>,
    val rowCount: Int,
    val executionMs: Long
)

// ═══════════════════════════════════════════════
//  Dashboard DTOs
// ═══════════════════════════════════════════════

data class DashboardReportRequest(
    val reportId: Long,
    val position: String = "{}",
    val sortOrder: Int = 0
)

data class DashboardDetailResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val settings: String,
    val status: String,
    val isPublic: Boolean,
    val autoRefreshSec: Int?,
    val reports: List<DashboardReportItem>,
    val createdBy: Long?,
    val createdAt: Instant,
    val updatedAt: Instant
)

data class DashboardReportItem(
    val dashboardReportId: Long,
    val reportId: Long,
    val reportName: String,
    val reportStatus: ReportStatus,
    val position: String,
    val sortOrder: Int
)

// ═══════════════════════════════════════════════
//  Schedule DTOs
// ═══════════════════════════════════════════════

data class CreateScheduleRequest(
    val reportId: Long,
    val cronExpression: String,
    val parameters: String = "{}",
    val outputFormat: OutputFormat = OutputFormat.JSON,
    val recipients: String = "[]"
)

data class UpdateScheduleRequest(
    val cronExpression: String? = null,
    val isActive: Boolean? = null,
    val parameters: String? = null,
    val outputFormat: OutputFormat? = null,
    val recipients: String? = null
)

data class ScheduleResponse(
    val id: Long,
    val reportId: Long,
    val reportName: String?,
    val cronExpression: String,
    val isActive: Boolean,
    val parameters: String,
    val outputFormat: OutputFormat,
    val recipients: String,
    val lastRunAt: Instant?,
    val lastStatus: ScheduleStatus?,
    val lastError: String?,
    val createdBy: Long?,
    val createdAt: Instant,
    val updatedAt: Instant
)

// ═══════════════════════════════════════════════
//  Snapshot DTOs
// ═══════════════════════════════════════════════

data class SnapshotResponse(
    val id: Long,
    val reportId: Long,
    val scheduleId: Long?,
    val parameters: String,
    val outputFormat: OutputFormat,
    val status: String,
    val executionMs: Long?,
    val errorMessage: String?,
    val createdBy: Long?,
    val createdAt: Instant
)
