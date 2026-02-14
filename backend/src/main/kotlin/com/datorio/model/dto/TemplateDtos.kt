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

data class ReportExportConfig(
    val formatVersion: Int = 1,
    val name: String,
    val description: String?,
    val reportType: ReportType,
    val layout: String,
    val settings: String,
    val category: String?,
    val parameters: List<ParameterExportConfig>,
    val widgets: List<WidgetExportConfig>
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

data class WidgetExportConfig(
    val widgetType: WidgetType,
    val title: String?,
    val rawSql: String?,
    val chartConfig: String,
    val position: String,
    val style: String,
    val paramMapping: String,
    val sortOrder: Int,
    val isVisible: Boolean
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
