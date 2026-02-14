package com.datorio.datasource

import com.datorio.model.DataSource
import com.datorio.model.DataSourceType
import com.datorio.model.dto.ColumnMeta
import com.datorio.model.dto.ConnectionTestResult
import com.datorio.model.dto.QueryResult
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.sql.ResultSet
import java.util.concurrent.ConcurrentHashMap

/**
 * Manages dynamic JDBC connections to user-configured data sources.
 * Each DataSource gets its own HikariCP pool, cached by datasource ID.
 */
@Component
class ConnectionManager {
    private val log = LoggerFactory.getLogger(javaClass)
    private val pools = ConcurrentHashMap<Long, HikariDataSource>()

    /**
     * Get or create a connection pool for the given data source.
     */
    fun getPool(ds: DataSource): HikariDataSource {
        return pools.computeIfAbsent(ds.id) { createPool(ds) }
    }

    /**
     * Test connectivity to a data source.
     */
    fun testConnection(ds: DataSource): ConnectionTestResult {
        val start = System.currentTimeMillis()
        return try {
            val pool = getPool(ds)
            pool.connection.use { conn ->
                conn.createStatement().use { stmt ->
                    val testQuery = when (ds.type) {
                        DataSourceType.POSTGRESQL -> "SELECT 1"
                        DataSourceType.CLICKHOUSE -> "SELECT 1"
                    }
                    stmt.executeQuery(testQuery)
                }
            }
            val duration = System.currentTimeMillis() - start
            ConnectionTestResult(
                success = true,
                message = "Connection successful (${ds.type})",
                durationMs = duration
            )
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - start
            log.error("Connection test failed for datasource ${ds.id}: ${e.message}")
            ConnectionTestResult(
                success = false,
                message = "Connection failed: ${e.message}",
                durationMs = duration
            )
        }
    }

    /**
    * Execute a SQL query against a data source.
    * Returns rows as List<Map<String, Any?>> for frontend compatibility.
    */
    fun executeQuery(ds: DataSource, sql: String, limit: Int = 1000): QueryResult {
        val start = System.currentTimeMillis()
        val pool = getPool(ds)

        return pool.connection.use { conn ->
            conn.createStatement().use { stmt ->
                stmt.maxRows = limit + 1  // fetch one extra to detect truncation
                val rs = stmt.executeQuery(sql)
                val meta = rs.metaData

                val columns = (1..meta.columnCount).map { i ->
                    ColumnMeta(
                        name = meta.getColumnLabel(i),
                        type = meta.getColumnTypeName(i),
                        nullable = meta.isNullable(i) != java.sql.ResultSetMetaData.columnNoNulls
                    )
                }

                val columnNames = columns.map { it.name }
                val rows = mutableListOf<Map<String, Any?>>()
                var count = 0
                while (rs.next() && count < limit) {
                    val row = mutableMapOf<String, Any?>()
                    columnNames.forEachIndexed { index, colName ->
                        row[colName] = extractValue(rs, index + 1)
                    }
                    rows.add(row)
                    count++
                }

                val truncated = rs.next() // if there's still a row, we hit the limit
                val duration = System.currentTimeMillis() - start

                QueryResult(
                    columns = columns,
                    rows = rows,
                    rowCount = rows.size,
                    executionTimeMs = duration,
                    truncated = truncated
                )
            }
        }
    }

    /**
     * Retrieve schema metadata: list of tables and their columns.
     */
    fun getSchemaInfo(ds: DataSource): List<TableInfo> {
        val pool = getPool(ds)
        return pool.connection.use { conn ->
            val dbMeta = conn.metaData
            val tables = mutableListOf<TableInfo>()

            val tableRs = when (ds.type) {
                DataSourceType.POSTGRESQL ->
                    dbMeta.getTables(null, "public", "%", arrayOf("TABLE", "VIEW"))
                DataSourceType.CLICKHOUSE ->
                    dbMeta.getTables(ds.databaseName, null, "%", arrayOf("TABLE", "VIEW"))
            }

            while (tableRs.next()) {
                val tableName = tableRs.getString("TABLE_NAME")
                val tableType = tableRs.getString("TABLE_TYPE")
                val colRs = dbMeta.getColumns(null, null, tableName, "%")
                val cols = mutableListOf<ColumnInfo>()
                while (colRs.next()) {
                    cols.add(
                        ColumnInfo(
                            name = colRs.getString("COLUMN_NAME"),
                            type = colRs.getString("TYPE_NAME"),
                            nullable = colRs.getInt("NULLABLE") != java.sql.DatabaseMetaData.columnNoNulls
                        )
                    )
                }
                tables.add(TableInfo(name = tableName, type = tableType, columns = cols))
            }
            tables
        }
    }

    /**
     * Remove and close a connection pool (when datasource is deleted/updated).
     */
    fun evictPool(datasourceId: Long) {
        pools.remove(datasourceId)?.close()
        log.info("Connection pool evicted for datasource $datasourceId")
    }

    private fun createPool(ds: DataSource): HikariDataSource {
        val config = HikariConfig().apply {
            jdbcUrl = ds.buildJdbcUrl()
            username = ds.username
            password = ds.passwordEnc  // TODO: decrypt in Phase 3
            maximumPoolSize = 5
            minimumIdle = 1
            connectionTimeout = 10_000
            idleTimeout = 300_000
            poolName = "datorio-ds-${ds.id}"

            // Driver-specific settings
            when (ds.type) {
                DataSourceType.POSTGRESQL -> {
                    driverClassName = "org.postgresql.Driver"
                }
                DataSourceType.CLICKHOUSE -> {
                    driverClassName = "com.clickhouse.jdbc.ClickHouseDriver"
                }
            }
        }
        log.info("Creating connection pool for datasource ${ds.id} (${ds.type}: ${ds.host}:${ds.port}/${ds.databaseName})")
        return HikariDataSource(config)
    }

    private fun extractValue(rs: ResultSet, index: Int): Any? {
        return try {
            rs.getString(index)
        } catch (e: Exception) {
            try { rs.getObject(index)?.toString() } catch (_: Exception) { null }
        }
    }
}

data class TableInfo(
    val name: String,
    val type: String,
    val columns: List<ColumnInfo>
)

data class ColumnInfo(
    val name: String,
    val type: String,
    val nullable: Boolean
)
