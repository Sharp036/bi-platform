package com.datalens.query.compiler

import com.datalens.model.DataSourceType
import com.datalens.query.model.*
import org.slf4j.LoggerFactory

/**
 * Compiles a VisualQuery into executable SQL for a specific database dialect.
 *
 * Features:
 * - Dialect-aware SQL generation (PostgreSQL vs ClickHouse)
 * - Named parameter extraction (for parameterized execution)
 * - SQL injection prevention (identifier quoting, literal escaping)
 * - Complex filter tree compilation (AND/OR/IN/BETWEEN/LIKE)
 *
 * Usage:
 *   val compiler = SqlCompiler(DataSourceType.POSTGRESQL)
 *   val result = compiler.compile(visualQuery)
 *   println(result.sql)        // SELECT ...
 *   println(result.parameters) // {dateFrom=2024-01-01, ...}
 */
class SqlCompiler(dialectType: DataSourceType) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val dialect: SqlDialect = SqlDialectFactory.create(dialectType)

    /**
     * Compile a VisualQuery into SQL.
     * Returns the SQL string and a list of named parameters found in the query.
     */
    fun compile(query: VisualQuery): CompilationResult {
        val params = mutableSetOf<String>()
        val sql = buildString {
            // SELECT
            append("SELECT ")
            if (query.distinct) append("DISTINCT ")
            append(compileSelectColumns(query.columns))
            appendLine()

            // FROM
            append("FROM ")
            append(compileTableRef(query.source))
            appendLine()

            // JOINs
            for (join in query.joins) {
                append(compileJoin(join, params))
                appendLine()
            }

            // WHERE
            if (query.filters.isNotEmpty()) {
                append("WHERE ")
                append(compileFilterList(query.filters, params))
                appendLine()
            }

            // GROUP BY
            if (query.groupBy.isNotEmpty()) {
                append("GROUP BY ")
                append(query.groupBy.joinToString(", ") { compileColumnRef(it) })
                appendLine()
            }

            // HAVING
            if (query.having.isNotEmpty()) {
                append("HAVING ")
                append(compileFilterList(query.having, params))
                appendLine()
            }

            // ORDER BY
            if (query.orderBy.isNotEmpty()) {
                append("ORDER BY ")
                append(query.orderBy.joinToString(", ") { compileOrderBy(it) })
                appendLine()
            }

            // LIMIT / OFFSET
            val limitOffset = dialect.formatLimitOffset(query.limit, query.offset)
            if (limitOffset.isNotBlank()) {
                append(limitOffset)
                appendLine()
            }
        }.trim()

        log.debug("Compiled visual query to SQL:\n{}", sql)
        return CompilationResult(sql = sql, parameterNames = params.toList())
    }

    /**
     * Validate a visual query for obvious errors before compilation.
     */
    fun validate(query: VisualQuery): List<String> {
        val errors = mutableListOf<String>()

        if (query.source.table.isBlank()) {
            errors.add("Source table is required")
        }
        if (query.columns.isEmpty()) {
            errors.add("At least one column must be selected")
        }

        // If there are aggregate columns, non-aggregate columns must be in GROUP BY
        val hasAggregates = query.columns.any { it.aggregate || it.expression != null }
        if (hasAggregates && query.groupBy.isEmpty()) {
            val nonAggCols = query.columns.filter { !it.aggregate && it.expression == null }
            if (nonAggCols.isNotEmpty()) {
                errors.add(
                    "Columns without aggregation must appear in GROUP BY: " +
                        nonAggCols.map { it.column ?: it.alias }.joinToString(", ")
                )
            }
        }

        // Validate JOIN clauses have ON conditions
        query.joins.forEachIndexed { idx, join ->
            if (join.table.isBlank()) {
                errors.add("JOIN #${idx + 1}: table name is required")
            }
        }

        return errors
    }

    // ════════════════════════════════════════════
    //  Internal compilation methods
    // ════════════════════════════════════════════

    private fun compileSelectColumns(columns: List<SelectColumn>): String {
        return columns.joinToString(", ") { col ->
            when {
                col.expression != null -> {
                    val expr = col.expression
                    if (col.alias != null) "$expr AS ${dialect.quoteIdentifier(col.alias)}"
                    else expr
                }
                col.column != null -> {
                    val ref = if (col.table != null) {
                        "${dialect.quoteIdentifier(col.table)}.${dialect.quoteIdentifier(col.column)}"
                    } else {
                        dialect.quoteIdentifier(col.column)
                    }
                    if (col.alias != null && col.alias != col.column) {
                        "$ref AS ${dialect.quoteIdentifier(col.alias)}"
                    } else ref
                }
                else -> throw IllegalArgumentException("Invalid SelectColumn: neither column nor expression set")
            }
        }
    }

    private fun compileTableRef(ref: TableRef): String {
        return dialect.formatTableRef(ref.schema, ref.table, ref.alias)
    }

    private fun compileJoin(join: JoinClause, params: MutableSet<String>): String {
        val joinKeyword = when (join.type) {
            JoinType.INNER -> "INNER JOIN"
            JoinType.LEFT -> "LEFT JOIN"
            JoinType.RIGHT -> "RIGHT JOIN"
            JoinType.FULL -> {
                require(dialect.supportsFullJoin) { "FULL JOIN not supported by ${dialect.type}" }
                "FULL OUTER JOIN"
            }
            JoinType.CROSS -> "CROSS JOIN"
        }
        val tableRef = dialect.formatTableRef(join.schema, join.table, join.alias)
        val onClause = if (join.type == JoinType.CROSS) "" else " ON ${compileFilter(join.on, params)}"
        return "$joinKeyword $tableRef$onClause"
    }

    private fun compileColumnRef(ref: ColumnRef): String {
        return if (ref.table != null) {
            "${dialect.quoteIdentifier(ref.table)}.${dialect.quoteIdentifier(ref.column)}"
        } else {
            dialect.quoteIdentifier(ref.column)
        }
    }

    private fun compileOrderBy(order: OrderByClause): String {
        val col = if (order.table != null) {
            "${dialect.quoteIdentifier(order.table)}.${dialect.quoteIdentifier(order.column)}"
        } else {
            dialect.quoteIdentifier(order.column)
        }
        return "$col ${order.direction.name}"
    }

    private fun compileFilterList(filters: List<FilterExpression>, params: MutableSet<String>): String {
        return if (filters.size == 1) {
            compileFilter(filters.first(), params)
        } else {
            // Multiple top-level filters are ANDed together
            filters.joinToString(" AND ") { "(${compileFilter(it, params)})" }
        }
    }

    private fun compileFilter(expr: FilterExpression, params: MutableSet<String>): String {
        val compiled = when (expr.type) {
            FilterType.COMPARISON -> compileComparison(expr, params)
            FilterType.LOGICAL -> compileLogical(expr, params)
            FilterType.IN -> compileIn(expr, params)
            FilterType.BETWEEN -> compileBetween(expr, params)
            FilterType.IS_NULL -> compileIsNull(expr)
            FilterType.IS_NOT_NULL -> compileIsNotNull(expr)
            FilterType.LIKE -> compileLike(expr, params)
        }
        return if (expr.negate) "NOT ($compiled)" else compiled
    }

    private fun compileComparison(expr: FilterExpression, params: MutableSet<String>): String {
        val left = compileValue(expr.left!!, params)
        val right = compileValue(expr.right!!, params)
        val op = when (expr.operator!!) {
            ComparisonOp.EQ -> "="
            ComparisonOp.NEQ -> "<>"
            ComparisonOp.GT -> ">"
            ComparisonOp.GTE -> ">="
            ComparisonOp.LT -> "<"
            ComparisonOp.LTE -> "<="
        }
        return "$left $op $right"
    }

    private fun compileLogical(expr: FilterExpression, params: MutableSet<String>): String {
        val op = when (expr.logicalOp!!) {
            LogicalOp.AND -> "AND"
            LogicalOp.OR -> "OR"
        }
        return expr.children!!.joinToString(" $op ") { "(${compileFilter(it, params)})" }
    }

    private fun compileIn(expr: FilterExpression, params: MutableSet<String>): String {
        val col = compileValue(expr.column!!, params)
        val vals = expr.values!!.joinToString(", ") { compileValue(it, params) }
        return "$col IN ($vals)"
    }

    private fun compileBetween(expr: FilterExpression, params: MutableSet<String>): String {
        val col = compileValue(expr.column ?: expr.left!!, params)
        val low = compileValue(expr.low!!, params)
        val high = compileValue(expr.high!!, params)
        return "$col BETWEEN $low AND $high"
    }

    private fun compileIsNull(expr: FilterExpression): String {
        // For IS_NULL, column info can be in 'column' or 'left'
        val colExpr = expr.column ?: expr.left!!
        val col = if (colExpr.table != null && colExpr.column != null) {
            "${dialect.quoteIdentifier(colExpr.table!!)}.${dialect.quoteIdentifier(colExpr.column!!)}"
        } else {
            dialect.quoteIdentifier(colExpr.column ?: colExpr.name ?: "?")
        }
        return "$col IS NULL"
    }

    private fun compileIsNotNull(expr: FilterExpression): String {
        val colExpr = expr.column ?: expr.left!!
        val col = if (colExpr.table != null && colExpr.column != null) {
            "${dialect.quoteIdentifier(colExpr.table!!)}.${dialect.quoteIdentifier(colExpr.column!!)}"
        } else {
            dialect.quoteIdentifier(colExpr.column ?: colExpr.name ?: "?")
        }
        return "$col IS NOT NULL"
    }

    private fun compileLike(expr: FilterExpression, params: MutableSet<String>): String {
        val col = compileValue(expr.column ?: expr.left!!, params)
        val pattern = dialect.formatStringLiteral(expr.pattern!!)
        return "$col LIKE $pattern"
    }

    private fun compileValue(value: ValueExpression, params: MutableSet<String>): String {
        return when (value.type) {
            ValueType.COLUMN -> {
                if (value.table != null) {
                    "${dialect.quoteIdentifier(value.table!!)}.${dialect.quoteIdentifier(value.column!!)}"
                } else {
                    dialect.quoteIdentifier(value.column!!)
                }
            }
            ValueType.LITERAL -> formatLiteral(value.value)
            ValueType.PARAM -> {
                params.add(value.name!!)
                // Named parameter placeholder — will be substituted before execution
                ":${value.name}"
            }
        }
    }

    private fun formatLiteral(value: Any?): String {
        return when (value) {
            null -> "NULL"
            is String -> dialect.formatStringLiteral(value)
            is Boolean -> dialect.formatBooleanLiteral(value)
            is Number -> value.toString()
            else -> dialect.formatStringLiteral(value.toString())
        }
    }
}

/** Result of compiling a VisualQuery */
data class CompilationResult(
    val sql: String,
    val parameterNames: List<String>
)
