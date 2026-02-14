package com.datorio.model.dto

import java.time.OffsetDateTime

// ═══════════════════════════════════════════
//  Annotations
// ═══════════════════════════════════════════

data class AnnotationRequest(
    val widgetId: Long,
    val annotationType: String = "LINE",    // LINE, BAND, TEXT, TREND
    val axis: String = "y",
    val value: Double? = null,
    val valueEnd: Double? = null,
    val label: String? = null,
    val color: String? = "#ef4444",
    val lineStyle: String? = "solid",
    val lineWidth: Double? = 1.5,
    val opacity: Double? = 0.8,
    val fillColor: String? = null,
    val fillOpacity: Double? = 0.1,
    val position: String? = "end",
    val fontSize: Int? = 12,
    val isVisible: Boolean = true,
    val sortOrder: Int = 0,
    val config: Map<String, Any?> = emptyMap()
)

data class AnnotationResponse(
    val id: Long,
    val widgetId: Long,
    val annotationType: String,
    val axis: String,
    val value: Double?,
    val valueEnd: Double?,
    val label: String?,
    val color: String?,
    val lineStyle: String?,
    val lineWidth: Double?,
    val opacity: Double?,
    val fillColor: String?,
    val fillOpacity: Double?,
    val position: String?,
    val fontSize: Int?,
    val isVisible: Boolean,
    val sortOrder: Int,
    val config: Map<String, Any?>,
    val createdAt: OffsetDateTime
)

// ═══════════════════════════════════════════
//  Tooltips
// ═══════════════════════════════════════════

data class TooltipConfigRequest(
    val widgetId: Long,
    val isEnabled: Boolean = true,
    val showTitle: Boolean = true,
    val titleField: String? = null,
    val fields: List<TooltipFieldDef> = emptyList(),
    val showSparkline: Boolean = false,
    val sparklineField: String? = null,
    val htmlTemplate: String? = null,
    val config: Map<String, Any?> = emptyMap()
)

data class TooltipFieldDef(
    val field: String,
    val label: String? = null,
    val format: String? = null,     // number, percent, currency, date
    val color: String? = null,
    val prefix: String? = null,
    val suffix: String? = null
)

data class TooltipConfigResponse(
    val id: Long,
    val widgetId: Long,
    val isEnabled: Boolean,
    val showTitle: Boolean,
    val titleField: String?,
    val fields: List<TooltipFieldDef>,
    val showSparkline: Boolean,
    val sparklineField: String?,
    val htmlTemplate: String?,
    val config: Map<String, Any?>,
    val createdAt: OffsetDateTime
)

// ═══════════════════════════════════════════
//  Containers
// ═══════════════════════════════════════════

data class ContainerRequest(
    val reportId: Long,
    val containerType: String = "TABS",     // TABS, ACCORDION, HORIZONTAL, VERTICAL
    val name: String? = null,
    val childWidgetIds: List<Long>,
    val activeTab: Int = 0,
    val autoDistribute: Boolean = true,
    val config: Map<String, Any?> = emptyMap(),
    val sortOrder: Int = 0
)

data class ContainerResponse(
    val id: Long,
    val reportId: Long,
    val containerType: String,
    val name: String?,
    val childWidgetIds: List<Long>,
    val activeTab: Int,
    val autoDistribute: Boolean,
    val config: Map<String, Any?>,
    val sortOrder: Int,
    val createdAt: OffsetDateTime
)
