package com.datalens.service

import com.datalens.datasource.ConnectionManager
import com.datalens.model.DataSource
import com.datalens.model.DataSourceType
import com.datalens.model.SchemaCache
import com.datalens.model.dto.*
import com.datalens.repository.DataSourceRepository
import com.datalens.repository.SchemaCacheRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

/**
 * Provides schema introspection with a two-layer caching strategy:
 * 1. In-memory Caffeine cache (fast, short TTL)
 * 2. Database-backed cache (survives restarts, longer TTL)
 *
 * The frontend query builder uses this to show available tables/columns.
 */
@Service
class SchemaService(
    private val dataSourceRepository: DataSourceRepository,
    private val schemaCacheRepository: SchemaCacheRepository,
    private val connectionManager: ConnectionManager
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        /** Consider DB cache fresh for 15 minutes */
        const val CACHE_TTL_MINUTES = 15L
    }

    /**
     * Get schema metadata for a datasource. Uses cache when available.
     */
    fun getSchema(datasourceId: Long, forceRefresh: Boolean = false): SchemaInfoResponse {
        val ds = dataSourceRepository.findById(datasourceId)
            .orElseThrow { NoSuchElementException("DataSource not found: $datasourceId") }

        val tables = if (forceRefresh) {
            refreshSchemaCache(ds)
        } else {
            getCachedOrRefresh(ds)
        }

        return SchemaInfoResponse(
            datasourceId = ds.id,
            datasourceName = ds.name,
            tables = tables,
            cachedAt = OffsetDateTime.now().toString()
        )
    }

    /**
     * Get columns for a specific table.
     */
    fun getTableColumns(datasourceId: Long, tableName: String, schema: String? = null): List<ColumnMetadata> {
        val schemaInfo = getSchema(datasourceId)
        return schemaInfo.tables
            .firstOrNull { it.name == tableName && (schema == null || it.schema == schema) }
            ?.columns
            ?: throw NoSuchElementException("Table '$tableName' not found in datasource $datasourceId")
    }

    /**
     * Preview first N rows of a table.
     */
    fun previewTable(request: TablePreviewRequest): QueryResult {
        val ds = dataSourceRepository.findById(request.datasourceId)
            .orElseThrow { NoSuchElementException("DataSource not found: ${request.datasourceId}") }

        val tableName = sanitizeIdentifier(request.table)
        val schemaPrefix = if (request.schema != null) "${sanitizeIdentifier(request.schema)}." else ""
        val sql = "SELECT * FROM ${schemaPrefix}${tableName}"

        return connectionManager.executeQuery(ds, sql, request.limit.coerceAtMost(500))
    }

    /**
     * Invalidate cache for a datasource (e.g., after connection settings change).
     */
    @Transactional
    fun invalidateCache(datasourceId: Long) {
        schemaCacheRepository.deleteByDatasourceId(datasourceId)
        log.info("Schema cache invalidated for datasource $datasourceId")
    }

    // ════════════════════════════════════════════
    //  Internal
    // ════════════════════════════════════════════

    private fun getCachedOrRefresh(ds: DataSource): List<TableMetadata> {
        val freshSince = OffsetDateTime.now().minusMinutes(CACHE_TTL_MINUTES)
        val cached = schemaCacheRepository.findFreshCache(ds.id, freshSince)

        return if (cached.isNotEmpty()) {
            log.debug("Using cached schema for datasource {} ({} tables)", ds.id, cached.size)
            cached.map { it.toTableMetadata() }
        } else {
            refreshSchemaCache(ds)
        }
    }

    @Transactional
    fun refreshSchemaCache(ds: DataSource): List<TableMetadata> {
        log.info("Refreshing schema cache for datasource {} ({})", ds.id, ds.name)

        // Clear old cache
        schemaCacheRepository.deleteByDatasourceId(ds.id)

        // Introspect via JDBC
        val rawTables = connectionManager.getSchemaInfo(ds)

        // Enrich with primary key info
        val tables = rawTables.map { rawTable ->
            val columns = rawTable.columns.map { col ->
                ColumnMetadata(
                    name = col.name,
                    type = col.type,
                    nullable = col.nullable,
                    isPrimaryKey = false,  // TODO: detect PKs via JDBC metadata
                    comment = null
                )
            }

            val schemaName = when (ds.type) {
                DataSourceType.POSTGRESQL -> "public"
                DataSourceType.CLICKHOUSE -> ds.databaseName
            }

            // Estimate row count
            val rowCount = estimateRowCount(ds, schemaName, rawTable.name)

            // Save to DB cache
            val cacheEntry = SchemaCache(
                datasource = ds,
                schemaName = schemaName,
                tableName = rawTable.name,
                tableType = rawTable.type,
                columnsJson = columns.map { c ->
                    mapOf(
                        "name" to c.name,
                        "type" to c.type,
                        "nullable" to c.nullable,
                        "isPrimaryKey" to c.isPrimaryKey
                    )
                },
                rowCountEst = rowCount
            )
            schemaCacheRepository.save(cacheEntry)

            TableMetadata(
                schema = schemaName,
                name = rawTable.name,
                type = rawTable.type,
                columns = columns,
                rowCountEstimate = rowCount
            )
        }

        log.info("Schema cache refreshed: {} tables found for datasource {}", tables.size, ds.id)
        return tables
    }

    private fun estimateRowCount(ds: DataSource, schema: String?, table: String): Long? {
        return try {
            val sql = when (ds.type) {
                DataSourceType.POSTGRESQL ->
                    "SELECT reltuples::BIGINT FROM pg_class WHERE relname = '${sanitizeIdentifier(table)}'"
                DataSourceType.CLICKHOUSE ->
                    "SELECT total_rows FROM system.tables WHERE database = '${ds.databaseName}' AND name = '${sanitizeIdentifier(table)}'"
            }
            val result = connectionManager.executeQuery(ds, sql, 1)
            if (result.rows.isNotEmpty()) {
                result.rows[0][0]?.toString()?.toLongOrNull()
            } else null
        } catch (e: Exception) {
            log.debug("Could not estimate row count for {}.{}: {}", schema, table, e.message)
            null
        }
    }

    private fun SchemaCache.toTableMetadata(): TableMetadata {
        val columns = columnsJson.map { col ->
            ColumnMetadata(
                name = col["name"] as String,
                type = col["type"] as String,
                nullable = col["nullable"] as? Boolean ?: true,
                isPrimaryKey = col["isPrimaryKey"] as? Boolean ?: false,
                comment = col["comment"] as? String
            )
        }
        return TableMetadata(
            schema = schemaName,
            name = tableName,
            type = tableType ?: "TABLE",
            columns = columns,
            rowCountEstimate = rowCountEst
        )
    }

    /** Basic sanitization — only allow alphanumeric + underscore */
    private fun sanitizeIdentifier(name: String): String {
        require(name.matches(Regex("[a-zA-Z_][a-zA-Z0-9_]*"))) {
            "Invalid identifier: '$name'"
        }
        return name
    }
}
