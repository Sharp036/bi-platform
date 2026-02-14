package com.datorio.model.dto

import java.time.OffsetDateTime

// ═══════════════════════════════════════════
//  Data Model
// ═══════════════════════════════════════════

data class DataModelCreateRequest(
    val name: String,
    val description: String? = null,
    val datasourceId: Long
)

data class DataModelUpdateRequest(
    val name: String? = null,
    val description: String? = null,
    val isPublished: Boolean? = null
)

data class DataModelResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val datasourceId: Long,
    val datasourceName: String?,
    val ownerId: Long,
    val isPublished: Boolean,
    val tableCount: Int,
    val fieldCount: Int,
    val relationshipCount: Int,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime
)

data class DataModelDetailResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val datasourceId: Long,
    val datasourceName: String?,
    val ownerId: Long,
    val isPublished: Boolean,
    val tables: List<ModelTableResponse>,
    val relationships: List<ModelRelationshipResponse>,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime
)

// ═══════════════════════════════════════════
//  Model Table
// ═══════════════════════════════════════════

data class ModelTableRequest(
    val tableSchema: String? = null,
    val tableName: String,
    val alias: String,
    val label: String? = null,
    val description: String? = null,
    val isPrimary: Boolean = false,
    val sqlExpression: String? = null,
    val sortOrder: Int = 0
)

data class ModelTableResponse(
    val id: Long,
    val modelId: Long,
    val tableSchema: String?,
    val tableName: String,
    val alias: String,
    val label: String?,
    val description: String?,
    val isPrimary: Boolean,
    val sqlExpression: String?,
    val sortOrder: Int,
    val fields: List<ModelFieldResponse>,
    val createdAt: OffsetDateTime
)

// ═══════════════════════════════════════════
//  Model Field
// ═══════════════════════════════════════════

data class ModelFieldRequest(
    val columnName: String? = null,
    val fieldRole: String = "DIMENSION",
    val label: String,
    val description: String? = null,
    val dataType: String? = null,
    val aggregation: String? = null,
    val expression: String? = null,
    val format: String? = null,
    val hidden: Boolean = false,
    val sortOrder: Int = 0
)

data class ModelFieldResponse(
    val id: Long,
    val modelTableId: Long,
    val tableAlias: String?,
    val columnName: String?,
    val fieldRole: String,
    val label: String,
    val description: String?,
    val dataType: String?,
    val aggregation: String?,
    val expression: String?,
    val format: String?,
    val hidden: Boolean,
    val sortOrder: Int,
    val createdAt: OffsetDateTime
)

// ═══════════════════════════════════════════
//  Model Relationship
// ═══════════════════════════════════════════

data class ModelRelationshipRequest(
    val leftTableId: Long,
    val leftColumn: String,
    val rightTableId: Long,
    val rightColumn: String,
    val joinType: String = "LEFT",
    val label: String? = null
)

data class ModelRelationshipResponse(
    val id: Long,
    val modelId: Long,
    val leftTableId: Long,
    val leftTableAlias: String?,
    val leftColumn: String,
    val rightTableId: Long,
    val rightTableAlias: String?,
    val rightColumn: String,
    val joinType: String,
    val label: String?,
    val isActive: Boolean,
    val createdAt: OffsetDateTime
)

// ═══════════════════════════════════════════
//  Explore (query via model)
// ═══════════════════════════════════════════

data class ExploreRequest(
    val modelId: Long,
    val fieldIds: List<Long>,
    val filters: List<ExploreFilter> = emptyList(),
    val sorts: List<ExploreSort> = emptyList(),
    val limit: Int = 1000
)

data class ExploreFilter(
    val fieldId: Long,
    val operator: String,       // EQ, NEQ, GT, GTE, LT, LTE, LIKE, IN, BETWEEN, IS_NULL, IS_NOT_NULL
    val value: String? = null,
    val values: List<String>? = null
)

data class ExploreSort(
    val fieldId: Long,
    val direction: String = "ASC"
)

data class ExploreResponse(
    val sql: String,
    val columns: List<String>,
    val rows: List<Map<String, Any?>>,
    val rowCount: Int,
    val executionMs: Long
)

// ═══════════════════════════════════════════
//  Auto-import from schema
// ═══════════════════════════════════════════

data class AutoImportRequest(
    val tableNames: List<String>,
    val tableSchema: String? = null,
    val detectRelationships: Boolean = true
)
