package com.datorio.query.compiler

import com.datorio.model.DataSourceType

/**
 * Abstracts SQL dialect differences between PostgreSQL and ClickHouse.
 * The SqlCompiler delegates dialect-specific formatting to this interface.
 */
interface SqlDialect {
    val type: DataSourceType

    /** Quote an identifier (table name, column name) */
    fun quoteIdentifier(name: String): String

    /** Format a table reference with optional schema */
    fun formatTableRef(schema: String?, table: String, alias: String?): String

    /** Format LIMIT/OFFSET clause */
    fun formatLimitOffset(limit: Int?, offset: Int?): String

    /** Format a string literal */
    fun formatStringLiteral(value: String): String

    /** Format boolean literal */
    fun formatBooleanLiteral(value: Boolean): String

    /** Does this dialect support FULL OUTER JOIN? */
    val supportsFullJoin: Boolean

    /** Does this dialect support OFFSET without LIMIT? */
    val supportsStandaloneOffset: Boolean

    /** Wrap a query for safe execution (e.g. add LIMIT if missing) */
    fun wrapForSafeExecution(sql: String, maxRows: Int): String
}

// ══════════════════════════════════════════════
//  PostgreSQL Dialect
// ══════════════════════════════════════════════

class PostgresDialect : SqlDialect {
    override val type = DataSourceType.POSTGRESQL
    override val supportsFullJoin = true
    override val supportsStandaloneOffset = true

    override fun quoteIdentifier(name: String): String {
        // Double-quote identifiers, escape embedded quotes
        return "\"${name.replace("\"", "\"\"")}\""
    }

    override fun formatTableRef(schema: String?, table: String, alias: String?): String {
        val ref = if (schema != null) {
            "${quoteIdentifier(schema)}.${quoteIdentifier(table)}"
        } else {
            quoteIdentifier(table)
        }
        return if (alias != null) "$ref AS ${quoteIdentifier(alias)}" else ref
    }

    override fun formatLimitOffset(limit: Int?, offset: Int?): String {
        val parts = mutableListOf<String>()
        if (limit != null) parts.add("LIMIT $limit")
        if (offset != null && offset > 0) parts.add("OFFSET $offset")
        return parts.joinToString(" ")
    }

    override fun formatStringLiteral(value: String): String {
        return "'${value.replace("'", "''")}'"
    }

    override fun formatBooleanLiteral(value: Boolean): String {
        return if (value) "TRUE" else "FALSE"
    }

    override fun wrapForSafeExecution(sql: String, maxRows: Int): String {
        val normalized = sql.trim().trimEnd(';')
        // If the query already has a LIMIT, don't add another
        if (normalized.uppercase().contains(Regex("\\bLIMIT\\s+\\d+"))) {
            return normalized
        }
        return "$normalized\nLIMIT $maxRows"
    }
}

// ══════════════════════════════════════════════
//  ClickHouse Dialect
// ══════════════════════════════════════════════

class ClickHouseDialect : SqlDialect {
    override val type = DataSourceType.CLICKHOUSE
    override val supportsFullJoin = true  // CH supports FULL since v21.8
    override val supportsStandaloneOffset = false  // CH requires LIMIT with OFFSET

    override fun quoteIdentifier(name: String): String {
        // ClickHouse uses backticks or double quotes
        return "`${name.replace("`", "\\`")}`"
    }

    override fun formatTableRef(schema: String?, table: String, alias: String?): String {
        val ref = if (schema != null) {
            "${quoteIdentifier(schema)}.${quoteIdentifier(table)}"
        } else {
            quoteIdentifier(table)
        }
        return if (alias != null) "$ref AS ${quoteIdentifier(alias)}" else ref
    }

    override fun formatLimitOffset(limit: Int?, offset: Int?): String {
        if (limit == null && offset == null) return ""
        if (limit == null && offset != null) {
            // ClickHouse requires LIMIT with OFFSET
            return "LIMIT ${Long.MAX_VALUE} OFFSET $offset"
        }
        val parts = mutableListOf("LIMIT $limit")
        if (offset != null && offset > 0) parts.add("OFFSET $offset")
        return parts.joinToString(" ")
    }

    override fun formatStringLiteral(value: String): String {
        return "'${value.replace("'", "\\'")}'"
    }

    override fun formatBooleanLiteral(value: Boolean): String {
        return if (value) "1" else "0"
    }

    override fun wrapForSafeExecution(sql: String, maxRows: Int): String {
        val normalized = sql.trim().trimEnd(';')
        if (normalized.uppercase().contains(Regex("\\bLIMIT\\s+\\d+"))) {
            return normalized
        }
        return "$normalized\nLIMIT $maxRows"
    }
}

// ══════════════════════════════════════════════
//  Factory
// ══════════════════════════════════════════════

object SqlDialectFactory {
    fun create(type: DataSourceType): SqlDialect = when (type) {
        DataSourceType.POSTGRESQL -> PostgresDialect()
        DataSourceType.CLICKHOUSE -> ClickHouseDialect()
    }
}
