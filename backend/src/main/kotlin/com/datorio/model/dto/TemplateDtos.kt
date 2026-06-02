package com.datorio.model.dto

import com.datorio.model.ReportType
import com.datorio.model.WidgetType
import com.datorio.model.ParamType

// ═══════════════════════════════════════════════
//  Template Gallery
// ═══════════════════════════════════════════════

data class TemplateListItem(
    val id: Long,
    val name: String,
    val description: String?,
    val category: String?,
    val preview: String?,
    val thumbnailUrl: String?,
    val widgetCount: Int,
    val createdAt: String
)

data class TemplateUpdateRequest(
    val category: String? = null,
    val preview: String? = null,
    val thumbnailUrl: String? = null
)

data class CreateFromTemplateRequest(
    val name: String,
    val datasourceId: Long? = null,
    val folderId: Long? = null
)

// ═══════════════════════════════════════════════
//  JSON Export / Import
// ═══════════════════════════════════════════════

data class ContainerExportConfig(
    val containerType: String,
    val name: String?,
    // Each inner list = one tab; references widgets by sortOrder (stable across import — IDs change)
    val childWidgetSortOrders: List<List<Int>>,
    val tabNames: List<String> = emptyList(),
    val activeTab: Int = 0,
    val sortOrder: Int = 0
)

data class ReportExportConfig(
    val formatVersion: Int = 2,
    val name: String,
    val description: String?,
    val reportType: ReportType,
    val layout: String,
    val settings: String,
    val category: String?,
    val parameters: List<ParameterExportConfig>,
    val widgets: List<WidgetExportConfig>,
    val containers: List<ContainerExportConfig> = emptyList(),
    val parameterControls: List<ParameterControlExportConfig> = emptyList()
)

data class ParameterExportConfig(
    val name: String,
    val label: String?,
    val paramType: ParamType,
    val defaultValue: String?,
    val isRequired: Boolean,
    val sortOrder: Int,
    val config: String
)

data class ParameterControlExportConfig(
    val parameterName: String,
    val controlType: String,
    val datasourceId: Long?,
    val optionsQuery: String?,
    val sliderMin: Double?,
    val sliderMax: Double?,
    val sliderStep: Double?,
    val config: String,
    val sortOrder: Int
)

data class ChartLayerExportConfig(
    val name: String,
    val label: String? = null,
    val rawSql: String? = null,
    val chartType: String = "line",
    val axis: String = "left",
    val color: String? = null,
    val opacity: Double = 1.0,
    val isVisible: Boolean = true,
    val sortOrder: Int = 0,
    val seriesConfig: String = "{}",
    val categoryField: String? = null,
    val valueField: String? = null,
    val paramMapping: String = "{}"
)

data class WidgetExportConfig(
    val widgetType: WidgetType,
    val title: String?,
    val body: String? = null,
    val rawSql: String?,
    val chartConfig: String,
    val position: String,
    val style: String,
    val paramMapping: String,
    val sortOrder: Int,
    val isVisible: Boolean,
    val layers: List<ChartLayerExportConfig> = emptyList()
)

data class ImportReportRequest(
    val config: ReportExportConfig,
    val name: String? = null,
    val datasourceId: Long? = null,
    val asTemplate: Boolean = false,
    val folderId: Long? = null
)

data class ImportResult(
    val reportId: Long,
    val name: String,
    val widgetCount: Int,
    val parameterCount: Int
)
