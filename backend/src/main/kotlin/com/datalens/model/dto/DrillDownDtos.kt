package com.datalens.model.dto

import com.datalens.model.DrillActionType
import com.datalens.model.TriggerType
import com.datalens.model.OpenMode
import java.time.Instant

// ── Create / Update ──

data class DrillActionCreateRequest(
    val sourceWidgetId: Long,
    val targetReportId: Long,
    val actionType: DrillActionType = DrillActionType.DRILL_DOWN,
    val label: String? = null,
    val description: String? = null,
    val paramMapping: Map<String, ParamMappingEntry> = emptyMap(),
    val triggerType: TriggerType = TriggerType.ROW_CLICK,
    val openMode: OpenMode = OpenMode.REPLACE,
    val sortOrder: Int = 0,
    val config: Map<String, Any?> = emptyMap()
)

data class DrillActionUpdateRequest(
    val targetReportId: Long? = null,
    val actionType: DrillActionType? = null,
    val label: String? = null,
    val description: String? = null,
    val paramMapping: Map<String, ParamMappingEntry>? = null,
    val triggerType: TriggerType? = null,
    val openMode: OpenMode? = null,
    val isActive: Boolean? = null,
    val sortOrder: Int? = null,
    val config: Map<String, Any?>? = null
)

data class ParamMappingEntry(
    val source: String,   // "column", "series", "fixed", "category", "value"
    val value: String      // column name, fixed value, etc.
)

// ── Response ──

data class DrillActionResponse(
    val id: Long,
    val sourceWidgetId: Long,
    val targetReportId: Long,
    val targetReportName: String?,
    val actionType: DrillActionType,
    val label: String?,
    val description: String?,
    val paramMapping: Map<String, ParamMappingEntry>,
    val triggerType: TriggerType,
    val openMode: OpenMode,
    val isActive: Boolean,
    val sortOrder: Int,
    val config: Map<String, Any?>,
    val createdAt: Instant,
    val updatedAt: Instant
)

// ── Drill navigation request (from frontend) ──

data class DrillNavigateRequest(
    val actionId: Long,
    val clickedData: Map<String, Any?> = emptyMap(),
    // Contains the clicked row/point data, e.g.:
    // { "region": "Europe", "amount": 5000, "seriesName": "Q1" }
    val currentParameters: Map<String, Any?> = emptyMap()
)

data class DrillNavigateResponse(
    val targetReportId: Long,
    val targetReportName: String,
    val resolvedParameters: Map<String, Any?>,
    val openMode: OpenMode,
    val breadcrumbLabel: String
)
