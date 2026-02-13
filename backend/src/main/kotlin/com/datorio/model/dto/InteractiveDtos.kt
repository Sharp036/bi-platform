package com.datorio.model.dto

import java.time.Instant

// ═══════════════════════════════════════════════
//  Chart Layer DTOs
// ═══════════════════════════════════════════════

data class ChartLayerRequest(
    val widgetId: Long,
    val name: String,
    val label: String? = null,
    val queryId: Long? = null,
    val datasourceId: Long? = null,
    val rawSql: String? = null,
    val chartType: String = "line",
    val axis: String = "left",
    val color: String? = null,
    val opacity: Double = 1.0,
    val isVisible: Boolean = true,
    val sortOrder: Int = 0,
    val seriesConfig: Map<String, Any?> = emptyMap(),
    val categoryField: String? = null,
    val valueField: String? = null,
    val paramMapping: Map<String, Any?> = emptyMap()
)

data class ChartLayerResponse(
    val id: Long,
    val widgetId: Long,
    val name: String,
    val label: String?,
    val queryId: Long?,
    val datasourceId: Long?,
    val rawSql: String?,
    val chartType: String,
    val axis: String,
    val color: String?,
    val opacity: Double,
    val isVisible: Boolean,
    val sortOrder: Int,
    val seriesConfig: Map<String, Any?>,
    val categoryField: String?,
    val valueField: String?,
    val createdAt: Instant
)

// ═══════════════════════════════════════════════
//  Dashboard Action DTOs
// ═══════════════════════════════════════════════

data class DashboardActionRequest(
    val reportId: Long,
    val name: String,
    val actionType: String = "FILTER",
    val triggerType: String = "CLICK",
    val sourceWidgetId: Long? = null,
    val targetWidgetIds: String? = null,
    val sourceField: String? = null,
    val targetField: String? = null,
    val targetReportId: Long? = null,
    val urlTemplate: String? = null,
    val config: Map<String, Any?> = emptyMap()
)

data class DashboardActionResponse(
    val id: Long,
    val reportId: Long,
    val name: String,
    val actionType: String,
    val triggerType: String,
    val sourceWidgetId: Long?,
    val targetWidgetIds: String?,
    val sourceField: String?,
    val targetField: String?,
    val targetReportId: Long?,
    val urlTemplate: String?,
    val isActive: Boolean,
    val sortOrder: Int,
    val config: Map<String, Any?>,
    val createdAt: Instant
)

// ═══════════════════════════════════════════════
//  Visibility Rule DTOs
// ═══════════════════════════════════════════════

data class VisibilityRuleRequest(
    val widgetId: Long,
    val ruleType: String = "PARAMETER",
    val parameterName: String? = null,
    val operator: String = "EQ",
    val expectedValue: String? = null
)

data class VisibilityRuleResponse(
    val id: Long,
    val widgetId: Long,
    val ruleType: String,
    val parameterName: String?,
    val operator: String,
    val expectedValue: String?,
    val isActive: Boolean,
    val createdAt: Instant
)

// ═══════════════════════════════════════════════
//  Dashboard Overlay DTOs
// ═══════════════════════════════════════════════

data class OverlayRequest(
    val reportId: Long,
    val overlayType: String = "IMAGE",
    val content: String? = null,
    val positionX: Int = 0,
    val positionY: Int = 0,
    val width: Int = 100,
    val height: Int = 50,
    val opacity: Double = 1.0,
    val zIndex: Int = 100,
    val linkUrl: String? = null,
    val isVisible: Boolean = true,
    val style: Map<String, Any?> = emptyMap()
)

data class OverlayResponse(
    val id: Long,
    val reportId: Long,
    val overlayType: String,
    val content: String?,
    val positionX: Int,
    val positionY: Int,
    val width: Int,
    val height: Int,
    val opacity: Double,
    val zIndex: Int,
    val linkUrl: String?,
    val isVisible: Boolean,
    val style: Map<String, Any?>,
    val createdAt: Instant
)

// ═══════════════════════════════════════════════
//  Enriched render response with interactive data
// ═══════════════════════════════════════════════

data class InteractiveReportMeta(
    val actions: List<DashboardActionResponse>,
    val visibilityRules: Map<Long, List<VisibilityRuleResponse>>,
    val overlays: List<OverlayResponse>,
    val chartLayers: Map<Long, List<ChartLayerResponse>>
)
