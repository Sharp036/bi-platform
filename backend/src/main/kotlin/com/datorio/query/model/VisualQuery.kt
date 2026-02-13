package com.datorio.query.model

/**
 * Visual Query Model — a structured, JSON-serializable representation
 * of a SQL query. The frontend query builder constructs this model
 * via drag-and-drop, and the SqlCompiler converts it to dialect-specific SQL.
 *
 * Example JSON:
 * {
 *   "source": { "table": "sales", "schema": "public", "alias": "s" },
 *   "joins": [{
 *     "table": "products", "schema": "public", "alias": "p",
 *     "type": "LEFT",
 *     "on": { "type": "COMPARISON", "left": {"type":"COLUMN","table":"s","column":"product_id"},
 *             "operator": "EQ", "right": {"type":"COLUMN","table":"p","column":"id"} }
 *   }],
 *   "columns": [
 *     { "table": "s", "column": "region", "alias": "region" },
 *     { "expression": "SUM(s.total_amount)", "alias": "revenue", "aggregate": true }
 *   ],
 *   "filters": [{ "type": "COMPARISON", "left": {"type":"COLUMN","table":"s","column":"sale_date"},
 *                 "operator": "GTE", "right": {"type":"PARAM","name":"dateFrom"} }],
 *   "groupBy": [{ "table": "s", "column": "region" }],
 *   "having": [],
 *   "orderBy": [{ "column": "revenue", "direction": "DESC" }],
 *   "limit": 1000,
 *   "offset": 0
 * }
 */

/** Root of a visual query definition */
data class VisualQuery(
    val source: TableRef,
    val joins: List<JoinClause> = emptyList(),
    val columns: List<SelectColumn>,
    val filters: List<FilterExpression> = emptyList(),
    val groupBy: List<ColumnRef> = emptyList(),
    val having: List<FilterExpression> = emptyList(),
    val orderBy: List<OrderByClause> = emptyList(),
    val limit: Int? = null,
    val offset: Int? = null,
    val distinct: Boolean = false
)

/** Reference to a database table */
data class TableRef(
    val table: String,
    val schema: String? = null,
    val alias: String? = null
)

/** A column in the SELECT clause */
data class SelectColumn(
    val table: String? = null,
    val column: String? = null,
    val expression: String? = null,  // raw expression like "SUM(s.amount)"
    val alias: String? = null,
    val aggregate: Boolean = false
) {
    init {
        require(column != null || expression != null) {
            "SelectColumn must have either 'column' or 'expression'"
        }
    }
}

/** Reference to a specific column (used in GROUP BY, etc.) */
data class ColumnRef(
    val table: String? = null,
    val column: String
)

/** JOIN clause */
data class JoinClause(
    val table: String,
    val schema: String? = null,
    val alias: String? = null,
    val type: JoinType = JoinType.INNER,
    val on: FilterExpression
)

enum class JoinType {
    INNER, LEFT, RIGHT, FULL, CROSS
}

/** ORDER BY clause */
data class OrderByClause(
    val table: String? = null,
    val column: String,
    val direction: SortDirection = SortDirection.ASC
)

enum class SortDirection { ASC, DESC }

// ════════════════════════════════════════════════════
//  Filter Expression Tree
//  Recursive structure for complex WHERE/HAVING/ON
// ════════════════════════════════════════════════════

/**
 * A filter expression can be:
 * - COMPARISON: left op right (e.g., s.region = 'North')
 * - LOGICAL: AND/OR combining child expressions
 * - IN: column IN (value1, value2, ...)
 * - BETWEEN: column BETWEEN low AND high
 * - IS_NULL / IS_NOT_NULL: column IS [NOT] NULL
 * - LIKE: column LIKE pattern
 */
data class FilterExpression(
    val type: FilterType,

    // For COMPARISON
    val left: ValueExpression? = null,
    val operator: ComparisonOp? = null,
    val right: ValueExpression? = null,

    // For LOGICAL (AND/OR)
    val logicalOp: LogicalOp? = null,
    val children: List<FilterExpression>? = null,

    // For IN
    val column: ValueExpression? = null,
    val values: List<ValueExpression>? = null,

    // For BETWEEN
    val low: ValueExpression? = null,
    val high: ValueExpression? = null,

    // For LIKE
    val pattern: String? = null,

    // Negate the entire expression
    val negate: Boolean = false
)

enum class FilterType {
    COMPARISON, LOGICAL, IN, BETWEEN, IS_NULL, IS_NOT_NULL, LIKE
}

enum class ComparisonOp {
    EQ, NEQ, GT, GTE, LT, LTE
}

enum class LogicalOp {
    AND, OR
}

/**
 * A value in a filter expression can be:
 * - COLUMN: reference to a table column
 * - LITERAL: a constant value (string, number, boolean)
 * - PARAM: a named parameter (resolved at execution time)
 */
data class ValueExpression(
    val type: ValueType,
    val table: String? = null,      // for COLUMN
    val column: String? = null,     // for COLUMN
    val value: Any? = null,         // for LITERAL
    val name: String? = null        // for PARAM
)

enum class ValueType {
    COLUMN, LITERAL, PARAM
}
