package com.datalens.service

import com.datalens.model.*
import com.datalens.model.dto.*
import com.datalens.repository.CalculatedFieldRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class CalculatedFieldService(
    private val calcRepo: CalculatedFieldRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Transactional
    fun create(request: CalcFieldCreateRequest): CalcFieldResponse {
        validateExpression(request.expression)
        val field = CalculatedField(
            reportId = request.reportId,
            name = request.name,
            label = request.label,
            expression = request.expression,
            resultType = request.resultType,
            formatPattern = request.formatPattern,
            sortOrder = request.sortOrder
        )
        return toResponse(calcRepo.save(field))
    }

    @Transactional
    fun update(id: Long, request: CalcFieldUpdateRequest): CalcFieldResponse {
        val field = calcRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Calculated field not found: $id") }
        request.name?.let { field.name = it }
        request.label?.let { field.label = it }
        request.expression?.let { validateExpression(it); field.expression = it }
        request.resultType?.let { field.resultType = it }
        request.formatPattern?.let { field.formatPattern = it }
        request.isActive?.let { field.isActive = it }
        request.sortOrder?.let { field.sortOrder = it }
        field.updatedAt = Instant.now()
        return toResponse(calcRepo.save(field))
    }

    fun getById(id: Long): CalcFieldResponse {
        val field = calcRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Calculated field not found: $id") }
        return toResponse(field)
    }

    fun listForReport(reportId: Long): List<CalcFieldResponse> {
        return calcRepo.findByReportIdOrderBySortOrder(reportId).map { toResponse(it) }
    }

    @Transactional
    fun delete(id: Long) {
        require(calcRepo.existsById(id)) { "Calculated field not found: $id" }
        calcRepo.deleteById(id)
    }

    /**
     * Evaluate calculated fields for a dataset.
     * Adds computed columns to each row.
     */
    fun applyCalculatedFields(
        reportId: Long,
        columns: List<String>,
        rows: List<Map<String, Any?>>
    ): Pair<List<String>, List<Map<String, Any?>>> {
        val fields = calcRepo.findByReportIdAndIsActiveTrueOrderBySortOrder(reportId)
        if (fields.isEmpty()) return columns to rows

        val newColumns = columns.toMutableList()
        fields.forEach { f ->
            if (f.name !in newColumns) newColumns.add(f.name)
        }

        val newRows = rows.map { row ->
            val mutableRow = row.toMutableMap()
            for (field in fields) {
                try {
                    mutableRow[field.name] = evaluateExpression(field.expression, mutableRow, field.resultType)
                } catch (e: Exception) {
                    log.debug("Failed to evaluate '{}': {}", field.expression, e.message)
                    mutableRow[field.name] = null
                }
            }
            mutableRow.toMap()
        }

        return newColumns to newRows
    }

    // ── Expression Engine ──

    /**
     * Simple expression evaluator supporting:
     * - Column references: [column_name]
     * - Arithmetic: +, -, *, /
     * - Comparisons: =, !=, >, <, >=, <=
     * - Functions: IF(cond, then, else), ABS(x), ROUND(x, n), UPPER(s), LOWER(s), CONCAT(a, b)
     * - Constants: numbers, "strings", true, false, null
     */
    private fun evaluateExpression(expr: String, row: Map<String, Any?>, resultType: ResultType): Any? {
        var resolved = expr.trim()

        // Replace column references [col] with actual values
        val colPattern = Regex("\\[([^\\]]+)]")
        resolved = colPattern.replace(resolved) { match ->
            val colName = match.groupValues[1]
            val value = row[colName]
            when (value) {
                null -> "null"
                is Number -> value.toString()
                is Boolean -> value.toString()
                else -> "\"${value.toString().replace("\"", "\\\"")}\""
            }
        }

        // Handle IF function
        val ifPattern = Regex("IF\\((.+?),\\s*(.+?),\\s*(.+?)\\)", RegexOption.IGNORE_CASE)
        resolved = ifPattern.replace(resolved) { match ->
            val cond = evaluateCondition(match.groupValues[1].trim(), row)
            if (cond) match.groupValues[2].trim() else match.groupValues[3].trim()
        }

        // Handle simple functions
        resolved = applyFunctions(resolved)

        // Evaluate arithmetic
        return when (resultType) {
            ResultType.NUMBER -> evaluateNumeric(resolved)
            ResultType.STRING -> evaluateString(resolved)
            ResultType.BOOLEAN -> evaluateBoolean(resolved)
            ResultType.DATE -> resolved.trim('"')
        }
    }

    private fun evaluateCondition(cond: String, row: Map<String, Any?>): Boolean {
        val operators = listOf("!=", ">=", "<=", "=", ">", "<")
        for (op in operators) {
            if (cond.contains(op)) {
                val parts = cond.split(op, limit = 2)
                if (parts.size == 2) {
                    val left = parseValue(parts[0].trim())
                    val right = parseValue(parts[1].trim())
                    return compareValues(left, right, op)
                }
            }
        }
        return false
    }

    private fun compareValues(left: Any?, right: Any?, op: String): Boolean {
        if (left == null || right == null) return false
        val lNum = (left as? Number)?.toDouble() ?: left.toString().toDoubleOrNull()
        val rNum = (right as? Number)?.toDouble() ?: right.toString().toDoubleOrNull()

        if (lNum != null && rNum != null) {
            return when (op) {
                "=" -> lNum == rNum
                "!=" -> lNum != rNum
                ">" -> lNum > rNum
                ">=" -> lNum >= rNum
                "<" -> lNum < rNum
                "<=" -> lNum <= rNum
                else -> false
            }
        }
        return when (op) {
            "=" -> left.toString() == right.toString()
            "!=" -> left.toString() != right.toString()
            else -> false
        }
    }

    private fun parseValue(s: String): Any? {
        val trimmed = s.trim().trim('"')
        if (trimmed == "null") return null
        if (trimmed == "true") return true
        if (trimmed == "false") return false
        return trimmed.toDoubleOrNull() ?: trimmed
    }

    private fun applyFunctions(expr: String): String {
        var result = expr
        // ABS
        result = Regex("ABS\\(([^)]+)\\)", RegexOption.IGNORE_CASE).replace(result) {
            val v = it.groupValues[1].trim().toDoubleOrNull() ?: 0.0
            kotlin.math.abs(v).toString()
        }
        // ROUND
        result = Regex("ROUND\\(([^,]+),\\s*(\\d+)\\)", RegexOption.IGNORE_CASE).replace(result) {
            val v = it.groupValues[1].trim().toDoubleOrNull() ?: 0.0
            val n = it.groupValues[2].trim().toIntOrNull() ?: 0
            "%.${n}f".format(v)
        }
        // UPPER / LOWER
        result = Regex("UPPER\\(([^)]+)\\)", RegexOption.IGNORE_CASE).replace(result) {
            it.groupValues[1].trim().trim('"').uppercase()
        }
        result = Regex("LOWER\\(([^)]+)\\)", RegexOption.IGNORE_CASE).replace(result) {
            it.groupValues[1].trim().trim('"').lowercase()
        }
        return result
    }

    private fun evaluateNumeric(expr: String): Double? {
        return try {
            // Simple arithmetic: supports +, -, *, /
            val tokens = tokenize(expr)
            evaluateTokens(tokens)
        } catch (_: Exception) {
            expr.trim().toDoubleOrNull()
        }
    }

    private fun evaluateString(expr: String): String {
        return expr.trim().trim('"')
    }

    private fun evaluateBoolean(expr: String): Boolean {
        return expr.trim().equals("true", ignoreCase = true)
    }

    private fun tokenize(expr: String): List<String> {
        val tokens = mutableListOf<String>()
        var current = StringBuilder()
        for (ch in expr.trim()) {
            if (ch in "+-*/" && current.isNotEmpty()) {
                tokens.add(current.toString().trim())
                tokens.add(ch.toString())
                current = StringBuilder()
            } else {
                current.append(ch)
            }
        }
        if (current.isNotEmpty()) tokens.add(current.toString().trim())
        return tokens
    }

    private fun evaluateTokens(tokens: List<String>): Double {
        if (tokens.isEmpty()) return 0.0
        if (tokens.size == 1) return tokens[0].toDoubleOrNull() ?: 0.0

        // First pass: * and /
        val afterMulDiv = mutableListOf<String>()
        var i = 0
        while (i < tokens.size) {
            if (i + 1 < tokens.size && (tokens[i + 1] == "*" || tokens[i + 1] == "/")) {
                val left = (afterMulDiv.removeLastOrNull() ?: tokens[i]).toDoubleOrNull() ?: 0.0
                val op = tokens[i + 1]
                val right = tokens.getOrNull(i + 2)?.toDoubleOrNull() ?: 0.0
                val result = if (op == "*") left * right else if (right != 0.0) left / right else 0.0
                afterMulDiv.add(result.toString())
                i += 3
            } else {
                afterMulDiv.add(tokens[i])
                i++
            }
        }

        // Second pass: + and -
        var result = afterMulDiv[0].toDoubleOrNull() ?: 0.0
        var j = 1
        while (j < afterMulDiv.size - 1) {
            val op = afterMulDiv[j]
            val right = afterMulDiv[j + 1].toDoubleOrNull() ?: 0.0
            result = if (op == "+") result + right else result - right
            j += 2
        }
        return result
    }

    private fun validateExpression(expr: String) {
        require(expr.isNotBlank()) { "Expression cannot be empty" }
        require(expr.length <= 2000) { "Expression too long (max 2000 chars)" }
        // Basic safety: no dangerous keywords
        val lower = expr.lowercase()
        val forbidden = listOf("drop ", "delete ", "insert ", "update ", "alter ", "exec ", "execute ")
        for (kw in forbidden) {
            require(kw !in lower) { "Expression contains forbidden keyword: $kw" }
        }
    }

    private fun toResponse(f: CalculatedField) = CalcFieldResponse(
        id = f.id, reportId = f.reportId, name = f.name,
        label = f.label, expression = f.expression,
        resultType = f.resultType, formatPattern = f.formatPattern,
        sortOrder = f.sortOrder, isActive = f.isActive,
        createdAt = f.createdAt, updatedAt = f.updatedAt
    )
}
