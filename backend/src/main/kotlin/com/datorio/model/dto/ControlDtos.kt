package com.datorio.model.dto

import java.time.OffsetDateTime

// ═══════════════════════════════════════════
//  Global Filter Config
// ═══════════════════════════════════════════

data class GlobalFilterConfigRequest(
    val reportId: Long,
    val widgetId: Long,
    val isFilterSource: Boolean = false,
    val filterField: String? = null,
    val excludedTargets: String? = null,
    val isEnabled: Boolean = true
)

data class GlobalFilterConfigResponse(
    val id: Long,
    val reportId: Long,
    val widgetId: Long,
    val isFilterSource: Boolean,
    val filterField: String?,
    val excludedTargets: String?,
    val isEnabled: Boolean,
    val createdAt: OffsetDateTime
)

// ═══════════════════════════════════════════
//  Parameter Control
// ═══════════════════════════════════════════

data class ParameterControlRequest(
    val reportId: Long,
    val parameterName: String,
    val controlType: String = "INPUT",
    val datasourceId: Long? = null,
    val optionsQuery: String? = null,
    val cascadeParent: String? = null,
    val cascadeField: String? = null,
    val sliderMin: Double? = null,
    val sliderMax: Double? = null,
    val sliderStep: Double? = 1.0,
    val config: Map<String, Any?> = emptyMap(),
    val sortOrder: Int = 0
)

data class ParameterControlResponse(
    val id: Long,
    val reportId: Long,
    val parameterName: String,
    val controlType: String,
    val datasourceId: Long?,
    val optionsQuery: String?,
    val cascadeParent: String?,
    val cascadeField: String?,
    val sliderMin: Double?,
    val sliderMax: Double?,
    val sliderStep: Double?,
    val config: Map<String, Any?>,
    val sortOrder: Int,
    val createdAt: OffsetDateTime
)

data class ParameterOptionsResponse(
    val parameterName: String,
    val options: List<String>
)

// ═══════════════════════════════════════════
//  Button Widget Config (stored in chartConfig JSON)
// ═══════════════════════════════════════════

data class ButtonConfig(
    val buttonType: String = "NAVIGATE",    // NAVIGATE, SHOW_HIDE, FILTER, EXPORT, URL
    val label: String = "Click",
    val icon: String? = null,
    val color: String? = null,
    val size: String = "medium",            // small, medium, large
    // NAVIGATE
    val targetReportId: Long? = null,
    val targetParams: Map<String, String> = emptyMap(),
    // SHOW_HIDE
    val toggleWidgetIds: List<Long> = emptyList(),
    // FILTER
    val filterField: String? = null,
    val filterValue: String? = null,
    // EXPORT
    val exportFormat: String? = null,       // PDF, EXCEL, CSV
    // URL
    val url: String? = null,
    val openInNewTab: Boolean = true
)
