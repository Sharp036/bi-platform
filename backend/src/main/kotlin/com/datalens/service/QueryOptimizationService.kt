package com.datalens.service

import com.datalens.datasource.ConnectionManager
import com.datalens.model.DataSourceType
import com.datalens.repository.DataSourceRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

data class QueryPlan(
    val planLines: List<String>,
    val estimatedCost: Double?,
    val estimatedRows: Long?,
    val warnings: List<String>,
    val suggestions: List<String>
)

@Service
class QueryOptimizationService(
    private val dataSourceRepository: DataSourceRepository,
    private val connectionManager: ConnectionManager
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Run EXPLAIN on a query and return the plan with optimization suggestions.
     */
    fun explain(datasourceId: Long, sql: String): QueryPlan {
        val ds = dataSourceRepository.findById(datasourceId)
            .orElseThrow { IllegalArgumentException("DataSource not found: $datasourceId") }

        val explainSql = when (ds.type) {
            DataSourceType.POSTGRESQL -> "EXPLAIN (FORMAT TEXT, COSTS, VERBOSE) $sql"
            DataSourceType.CLICKHOUSE -> "EXPLAIN $sql"
        }

        val pool = connectionManager.getPool(ds)
        val planLines = mutableListOf<String>()

        pool.connection.use { conn ->
            conn.createStatement().use { stmt ->
                stmt.executeQuery(explainSql).use { rs ->
                    while (rs.next()) {
                        planLines.add(rs.getString(1))
                    }
                }
            }
        }

        val warnings = mutableListOf<String>()
        val suggestions = mutableListOf<String>()
        var estimatedCost: Double? = null
        var estimatedRows: Long? = null

        // Analyze plan
        val planText = planLines.joinToString("\n").lowercase()

        // Extract cost from PostgreSQL plan
        val costMatch = Regex("cost=(\\d+\\.?\\d*)\\.\\.([\\d.]+)\\s+rows=(\\d+)").find(planText)
        if (costMatch != null) {
            estimatedCost = costMatch.groupValues[2].toDoubleOrNull()
            estimatedRows = costMatch.groupValues[3].toLongOrNull()
        }

        // Detect sequential scans
        if ("seq scan" in planText) {
            warnings.add("Sequential scan detected — may be slow on large tables")
            suggestions.add("Consider adding an index on columns used in WHERE/JOIN clauses")
        }

        // Detect sort without index
        if ("sort" in planText && "index" !in planText) {
            warnings.add("Sort operation without index — may use significant memory")
            suggestions.add("Add an index on ORDER BY columns to avoid in-memory sort")
        }

        // Detect nested loops with large row counts
        if ("nested loop" in planText && (estimatedRows ?: 0) > 10000) {
            warnings.add("Nested loop join with high row estimate")
            suggestions.add("Consider rewriting as a hash join or adding indexes on join columns")
        }

        // Detect missing WHERE clause on large results
        if (estimatedRows != null && estimatedRows > 100000 && "filter" !in planText) {
            warnings.add("Large result set without filtering (${estimatedRows} rows)")
            suggestions.add("Add WHERE conditions or LIMIT to reduce result size")
        }

        // High cost
        if (estimatedCost != null && estimatedCost > 10000) {
            warnings.add("High estimated cost: $estimatedCost")
        }

        // General suggestions
        if ("like '%'" in planText || "like '%" in planText) {
            suggestions.add("Leading wildcard in LIKE prevents index usage — consider full-text search")
        }

        if ("select *" in sql.lowercase()) {
            suggestions.add("Use explicit column list instead of SELECT * for better performance")
        }

        if ("distinct" in planText && estimatedRows != null && estimatedRows > 1000) {
            suggestions.add("DISTINCT on large result sets is expensive — ensure it's necessary")
        }

        if (warnings.isEmpty()) {
            suggestions.add("Query plan looks efficient")
        }

        return QueryPlan(
            planLines = planLines,
            estimatedCost = estimatedCost,
            estimatedRows = estimatedRows,
            warnings = warnings,
            suggestions = suggestions
        )
    }

    /**
     * Quick analysis of SQL text without running EXPLAIN (syntax-based hints).
     */
    fun quickAnalysis(sql: String): List<String> {
        val hints = mutableListOf<String>()
        val lower = sql.lowercase().trim()

        if ("select *" in lower) {
            hints.add("Avoid SELECT * — select only needed columns")
        }
        if (!lower.contains("limit") && !lower.contains("top ")) {
            hints.add("Consider adding LIMIT to prevent returning too many rows")
        }
        if (lower.contains("order by") && !lower.contains("limit")) {
            hints.add("ORDER BY without LIMIT sorts entire result set — add LIMIT if possible")
        }
        if (Regex("like\\s+'%").containsMatchIn(lower)) {
            hints.add("Leading wildcard LIKE cannot use indexes")
        }
        if (lower.count { it == '(' } > 5) {
            hints.add("Complex nested subqueries — consider using CTEs (WITH clause) for readability")
        }
        if ("in (" in lower && lower.substringAfter("in (").substringBefore(")").count { it == ',' } > 50) {
            hints.add("Large IN list — consider using a temporary table or JOIN instead")
        }
        if ("cross join" in lower) {
            hints.add("CROSS JOIN produces cartesian product — ensure this is intentional")
        }

        if (hints.isEmpty()) {
            hints.add("No obvious issues detected")
        }
        return hints
    }
}
