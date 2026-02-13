package com.datorio.model.dto

import com.datorio.model.ExecutionStatus
import com.datorio.model.QueryMode
import com.datorio.query.model.VisualQuery
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull

// ════════════════════════════════════════════════════
//  Visual Query Builder DTOs
// ════════════════════════════════════════════════════

/** Request to compile a visual query to SQL without executing it */
data class CompileQueryRequest(
    @field:NotNull val datasourceId: Long,
    @field:NotNull val visualQuery: VisualQuery
)

data class CompileQueryResponse(
    val sql: String,
    val parameterNames: List<String>,
    val validationErrors: List<String>
)

/** Request to execute a visual query */
data class ExecuteVisualQueryRequest(
    @field:NotNull val datasourceId: Long,
    @field:NotNull val visualQuery: VisualQuery,
    val parameters: Map<String, Any?> = emptyMap(),
    val limit: Int = 1000
)

// ════════════════════════════════════════════════════
//  Saved Query DTOs
// ════════════════════════════════════════════════════

data class SavedQueryCreateRequest(
    @field:NotBlank val name: String,
    val description: String? = null,
    @field:NotNull val datasourceId: Long,
    val queryMode: QueryMode = QueryMode.RAW,
    val sqlText: String? = null,
    val visualQuery: VisualQuery? = null,
    val parameters: List<QueryParameterDef> = emptyList(),
    val folderId: Long? = null
) {
    init {
        when (queryMode) {
            QueryMode.RAW -> require(!sqlText.isNullOrBlank()) {
                "sqlText is required for RAW query mode"
            }
            QueryMode.VISUAL -> require(visualQuery != null) {
                "visualQuery is required for VISUAL query mode"
            }
        }
    }
}

data class SavedQueryUpdateRequest(
    val name: String? = null,
    val description: String? = null,
    val queryMode: QueryMode? = null,
    val sqlText: String? = null,
    val visualQuery: VisualQuery? = null,
    val parameters: List<QueryParameterDef>? = null,
    val folderId: Long? = null,
    val changeNote: String? = null  // for versioning
)

data class QueryParameterDef(
    val name: String,
    val type: String,           // STRING, NUMBER, DATE, BOOLEAN, LIST
    val label: String? = null,
    val defaultValue: Any? = null,
    val required: Boolean = true,
    val options: List<Any>? = null  // for LIST type
)

data class SavedQueryResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val datasourceId: Long,
    val datasourceName: String,
    val queryMode: QueryMode,
    val sqlText: String,
    val compiledSql: String?,
    val parameters: List<QueryParameterDef>,
    val isFavorite: Boolean,
    val executionCount: Long,
    val avgExecutionMs: Long?,
    val lastExecutedAt: String?,
    val currentVersionNumber: Int?,
    val folderId: Long?,
    val createdBy: String?,
    val createdAt: String,
    val updatedAt: String
)

data class SavedQueryListItem(
    val id: Long,
    val name: String,
    val description: String?,
    val datasourceName: String,
    val queryMode: QueryMode,
    val isFavorite: Boolean,
    val executionCount: Long,
    val lastExecutedAt: String?,
    val folderId: Long?,
    val createdBy: String?,
    val updatedAt: String
)

// ════════════════════════════════════════════════════
//  Query Version DTOs
// ════════════════════════════════════════════════════

data class QueryVersionResponse(
    val id: Long,
    val versionNumber: Int,
    val queryMode: QueryMode,
    val sqlText: String?,
    val compiledSql: String?,
    val changeNote: String?,
    val createdBy: String?,
    val createdAt: String
)

// ════════════════════════════════════════════════════
//  Schema DTOs (enhanced)
// ════════════════════════════════════════════════════

data class SchemaInfoResponse(
    val datasourceId: Long,
    val datasourceName: String,
    val tables: List<TableMetadata>,
    val cachedAt: String?
)

data class TableMetadata(
    val schema: String?,
    val name: String,
    val type: String,          // TABLE, VIEW
    val columns: List<ColumnMetadata>,
    val rowCountEstimate: Long?
)

data class ColumnMetadata(
    val name: String,
    val type: String,
    val nullable: Boolean,
    val isPrimaryKey: Boolean = false,
    val comment: String? = null
)

/** Request to preview data from a specific table */
data class TablePreviewRequest(
    val datasourceId: Long,
    val schema: String? = null,
    val table: String,
    val limit: Int = 50
)

// ════════════════════════════════════════════════════
//  Query Execution Audit DTOs
// ════════════════════════════════════════════════════

data class QueryExecutionResponse(
    val id: Long,
    val username: String?,
    val datasourceName: String?,
    val savedQueryName: String?,
    val sqlSnippet: String,       // first 200 chars of SQL
    val status: ExecutionStatus,
    val rowCount: Int?,
    val executionMs: Long?,
    val errorMessage: String?,
    val createdAt: String
)

data class QueryExecutionFilter(
    val userId: Long? = null,
    val datasourceId: Long? = null,
    val status: ExecutionStatus? = null,
    val from: String? = null,     // ISO datetime
    val to: String? = null,
    val page: Int = 0,
    val size: Int = 50
)

// ════════════════════════════════════════════════════
//  Query Folder DTOs
// ════════════════════════════════════════════════════

data class QueryFolderCreateRequest(
    @field:NotBlank val name: String,
    val parentId: Long? = null
)

data class QueryFolderResponse(
    val id: Long,
    val name: String,
    val parentId: Long?,
    val children: List<QueryFolderResponse> = emptyList(),
    val queryCount: Int = 0
)
