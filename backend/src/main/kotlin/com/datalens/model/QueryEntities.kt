package com.datalens.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.OffsetDateTime

// ════════════════════════════════════════════════════
//  Saved Query (enhanced with versioning support)
// ════════════════════════════════════════════════════

@Entity
@Table(name = "dl_query")
data class SavedQuery(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 200)
    var name: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "datasource_id", nullable = false)
    val datasource: DataSource,

    @Column(name = "sql_text", columnDefinition = "TEXT", nullable = false)
    var sqlText: String,

    @Enumerated(EnumType.STRING)
    @Column(name = "query_mode", nullable = false, length = 20)
    var queryMode: QueryMode = QueryMode.RAW,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "visual_query", columnDefinition = "jsonb")
    var visualQuery: Map<String, Any>? = null,

    @Column(name = "compiled_sql", columnDefinition = "TEXT")
    var compiledSql: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parameters", columnDefinition = "jsonb")
    var parameters: List<Map<String, Any>> = emptyList(),

    @Column(name = "is_favorite", nullable = false)
    var isFavorite: Boolean = false,

    @Column(name = "execution_count", nullable = false)
    var executionCount: Long = 0,

    @Column(name = "avg_execution_ms")
    var avgExecutionMs: Long? = null,

    @Column(name = "last_executed_at")
    var lastExecutedAt: OffsetDateTime? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id")
    var folder: QueryFolder? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    val createdBy: User? = null,

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_version_id")
    var currentVersion: QueryVersion? = null,

    @OneToMany(mappedBy = "query", cascade = [CascadeType.ALL], orphanRemoval = true)
    val versions: MutableList<QueryVersion> = mutableListOf(),

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now()
)

enum class QueryMode { RAW, VISUAL }

// ════════════════════════════════════════════════════
//  Query Version
// ════════════════════════════════════════════════════

@Entity
@Table(name = "dl_query_version")
data class QueryVersion(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "query_id", nullable = false)
    val query: SavedQuery,

    @Column(name = "version_number", nullable = false)
    val versionNumber: Int,

    @Column(name = "sql_text", columnDefinition = "TEXT")
    val sqlText: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "visual_query", columnDefinition = "jsonb")
    val visualQuery: Map<String, Any>? = null,

    @Column(name = "compiled_sql", columnDefinition = "TEXT")
    val compiledSql: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "query_mode", nullable = false, length = 20)
    val queryMode: QueryMode = QueryMode.RAW,

    @Column(name = "change_note", columnDefinition = "TEXT")
    val changeNote: String? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    val createdBy: User? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

// ════════════════════════════════════════════════════
//  Schema Metadata Cache
// ════════════════════════════════════════════════════

@Entity
@Table(name = "dl_schema_cache")
data class SchemaCache(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "datasource_id", nullable = false)
    val datasource: DataSource,

    @Column(name = "schema_name", length = 200)
    val schemaName: String? = null,

    @Column(name = "table_name", nullable = false, length = 200)
    val tableName: String,

    @Column(name = "table_type", length = 50)
    val tableType: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "columns_json", columnDefinition = "jsonb", nullable = false)
    var columnsJson: List<Map<String, Any>> = emptyList(),

    @Column(name = "row_count_est")
    var rowCountEst: Long? = null,

    @Column(name = "cached_at", nullable = false)
    var cachedAt: OffsetDateTime = OffsetDateTime.now()
)

// ════════════════════════════════════════════════════
//  Query Execution Log
// ════════════════════════════════════════════════════

@Entity
@Table(name = "dl_query_execution")
data class QueryExecution(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    val user: User? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "datasource_id")
    val datasource: DataSource? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saved_query_id")
    val savedQuery: SavedQuery? = null,

    @Column(name = "sql_text", columnDefinition = "TEXT", nullable = false)
    val sqlText: String,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parameters", columnDefinition = "jsonb")
    val parameters: Map<String, Any?> = emptyMap(),

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val status: ExecutionStatus,

    @Column(name = "row_count")
    val rowCount: Int? = null,

    @Column(name = "execution_ms")
    val executionMs: Long? = null,

    @Column(name = "error_message", columnDefinition = "TEXT")
    val errorMessage: String? = null,

    @Column(name = "ip_address", length = 45)
    val ipAddress: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

enum class ExecutionStatus { SUCCESS, ERROR, TIMEOUT, CANCELLED }

// ════════════════════════════════════════════════════
//  Query Folder
// ════════════════════════════════════════════════════

@Entity
@Table(name = "dl_query_folder")
data class QueryFolder(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 200)
    var name: String,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    val parent: QueryFolder? = null,

    @OneToMany(mappedBy = "parent", cascade = [CascadeType.ALL])
    val children: MutableList<QueryFolder> = mutableListOf(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    val createdBy: User? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)
