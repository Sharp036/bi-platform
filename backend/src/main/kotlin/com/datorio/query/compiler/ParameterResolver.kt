package com.datorio.query.compiler

import com.datorio.model.DataSourceType
import org.slf4j.LoggerFactory

/**
 * Resolves named parameters (:paramName) in compiled SQL by substituting
 * them with properly escaped literal values.
 *
 * In a production system you'd ideally use JDBC PreparedStatement with positional
 * parameters. This resolver is a middle ground that works with both PG and CH
 * drivers without requiring driver-specific named-parameter support.
 *
 * Security: all values are escaped through the dialect's literal formatting.
 */
class ParameterResolver(dialectType: DataSourceType) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val dialect = SqlDialectFactory.create(dialectType)

    /**
     * Resolve named parameters in SQL.
     *
     * @param sql SQL with :paramName placeholders
     * @param parameters map of parameter name → value
     * @return SQL with parameters replaced by escaped literals
     * @throws IllegalArgumentException if a required parameter is missing
     */
    fun resolve(sql: String, parameters: Map<String, Any?>): String {
        if (parameters.isEmpty() && !sql.contains(Regex(":[a-zA-Z_]"))) return sql

        var resolved = sql
        // Find all :paramName tokens (not inside quotes)
        val paramPattern = Regex(":([a-zA-Z_][a-zA-Z0-9_]*)")
        val foundParams = paramPattern.findAll(sql).map { it.groupValues[1] }.toSet()

        for (paramName in foundParams) {
            require(parameters.containsKey(paramName)) {
                "Missing required parameter: '$paramName'"
            }
            val value = parameters[paramName]
            val literal = formatParameterValue(value)
            // Replace all occurrences of :paramName (word boundary aware)
            resolved = resolved.replace(
                Regex(":${Regex.escape(paramName)}\\b"),
                literal
            )
        }

        log.debug("Resolved {} parameters in SQL", foundParams.size)
        return resolved
    }

    /**
     * Extract all named parameter names from a SQL string.
     */
    fun extractParameterNames(sql: String): List<String> {
        val paramPattern = Regex(":([a-zA-Z_][a-zA-Z0-9_]*)")
        return paramPattern.findAll(sql).map { it.groupValues[1] }.distinct().toList()
    }

    private fun formatParameterValue(value: Any?): String {
        return when (value) {
            null -> "NULL"
            is String -> dialect.formatStringLiteral(value)
            is Boolean -> dialect.formatBooleanLiteral(value)
            is Number -> value.toString()
            is Collection<*> -> {
                // For IN clauses: (val1, val2, val3)
                value.joinToString(", ") { formatParameterValue(it) }
            }
            else -> dialect.formatStringLiteral(value.toString())
        }
    }
}
