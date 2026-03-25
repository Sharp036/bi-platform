package com.datorio.model.dto

import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull

data class ImportSourceRequest(
    @field:NotBlank val name: String,
    val description: String? = null,
    @field:NotNull val datasourceId: Long,
    @field:NotBlank val sourceFormat: String,
    val sheetName: String? = null,
    val headerRow: Int = 1,
    val skipRows: Int = 0,
    @field:NotBlank val targetSchema: String,
    @field:NotBlank val targetTable: String,
    val loadMode: String = "append",
    val keyColumns: List<String>? = null,
    val filenamePattern: String? = null,
    val strictColumns: Boolean = false,
    val forbiddenColumns: List<String>? = null,
    val fileEncoding: String = "UTF-8",
    val jsonArrayPath: String? = null,
    @field:Valid val mappings: List<ImportSourceMappingRequest> = emptyList()
)

data class ImportSourceMappingRequest(
    val sourceColumn: String? = null,
    @field:NotBlank val targetColumn: String,
    @field:NotBlank val dataType: String,
    val nullable: Boolean = true,
    val dateFormat: String? = null,
    val constValue: String? = null
)

data class ImportSourceMappingResponse(
    val id: Long,
    val sourceColumn: String?,
    val targetColumn: String,
    val dataType: String,
    val nullable: Boolean,
    val dateFormat: String?,
    val constValue: String?
)

data class ImportSourceResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val datasourceId: Long,
    val datasourceName: String,
    val sourceFormat: String,
    val sheetName: String?,
    val headerRow: Int,
    val skipRows: Int,
    val targetSchema: String,
    val targetTable: String,
    val loadMode: String,
    val keyColumns: List<String>?,
    val filenamePattern: String?,
    val strictColumns: Boolean,
    val forbiddenColumns: List<String>?,
    val fileEncoding: String,
    val jsonArrayPath: String?,
    val mappings: List<ImportSourceMappingResponse>,
    val createdAt: String
)

data class ImportPreviewResponse(
    val columns: List<String>,
    val rows: List<List<Any?>>
)

data class ImportErrorDetail(
    val rowNumber: Int,
    val columnName: String?,
    val errorMessage: String
)

data class ImportUploadResult(
    val logId: Long,
    val rowsTotal: Int,
    val rowsImported: Int,
    val rowsFailed: Int,
    val status: String,
    val errors: List<ImportErrorDetail>
)

data class ImportLogResponse(
    val id: Long,
    val sourceId: Long,
    val sourceName: String,
    val filename: String,
    val uploadedBy: String?,
    val uploadedAt: String,
    val rowsTotal: Int?,
    val rowsImported: Int?,
    val rowsFailed: Int?,
    val status: String,
    val errorDetail: String?
)
