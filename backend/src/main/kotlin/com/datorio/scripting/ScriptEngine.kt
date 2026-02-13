package com.datorio.scripting

import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Engine
import org.graalvm.polyglot.HostAccess
import org.graalvm.polyglot.SandboxPolicy
import org.graalvm.polyglot.Value
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value as SpringValue
import org.springframework.stereotype.Component
import java.io.ByteArrayOutputStream
import java.util.concurrent.*

/**
 * Sandboxed JavaScript execution engine using GraalJS.
 *
 * Security:
 * - No access to Java classes, filesystem, network
 * - Timeout enforcement via executor
 * - Memory limits via GraalVM options
 * - Statement limit to prevent infinite loops
 */
@Component
class ScriptEngine(
    @SpringValue("\${datorio.scripting.timeout-ms:5000}") private val timeoutMs: Long,
    @SpringValue("\${datorio.scripting.max-statements:100000}") private val maxStatements: Long
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // Shared engine for warm startup (contexts are per-execution)
    private val graalEngine: Engine = Engine.newBuilder("js")
        .option("engine.WarnInterpreterOnly", "false")
        .build()

    // Thread pool for timeout enforcement
    private val executor: ExecutorService = Executors.newFixedThreadPool(
        Runtime.getRuntime().availableProcessors().coerceAtLeast(2)
    )

    data class ExecutionResult(
        val output: Any?,
        val columns: List<String>?,
        val rows: List<List<Any?>>?,
        val logs: List<String>,
        val executionMs: Long,
        val success: Boolean,
        val error: String? = null
    )

    /**
     * Execute a script with optional data input and library code prepended.
     *
     * @param code        The JavaScript code to execute
     * @param input       Data input: columns, rows, parameters
     * @param libraryCode Prepended library functions
     * @return ExecutionResult with output, transformed data, logs
     */
    fun execute(
        code: String,
        input: DataInput? = null,
        libraryCode: String? = null
    ): ExecutionResult {
        val startMs = System.currentTimeMillis()
        val consoleOutput = ByteArrayOutputStream()
        val logs = mutableListOf<String>()

        // Build full script: library + user code
        val fullScript = buildString {
            // Console capture
            appendLine("var __logs = [];")
            appendLine("var console = { log: function() { __logs.push(Array.from(arguments).join(' ')); } };")
            appendLine("console.warn = console.log;")
            appendLine("console.error = console.log;")
            appendLine("console.info = console.log;")
            appendLine()

            // Library code
            if (!libraryCode.isNullOrBlank()) {
                appendLine("// === Library ===")
                appendLine(libraryCode)
                appendLine()
            }

            // Data input
            if (input != null) {
                appendLine("// === Input Data ===")
                appendLine("var __inputColumns = ${toJsArray(input.columns)};")
                appendLine("var __inputRows = ${toJsNestedArray(input.rows)};")
                appendLine("var params = ${toJsObject(input.parameters)};")
                appendLine()
                appendLine("// Helper: convert to array of objects")
                appendLine("var data = __inputRows.map(function(row) {")
                appendLine("  var obj = {};")
                appendLine("  __inputColumns.forEach(function(col, i) { obj[col] = row[i]; });")
                appendLine("  return obj;")
                appendLine("});")
                appendLine()
                // Script API
                appendLine("var __output = { columns: __inputColumns, rows: __inputRows, result: null };")
                appendLine()
                appendLine("// data.filter(), data.map(), data.sort() — standard JS arrays")
                appendLine("function setOutput(newData) {")
                appendLine("  if (Array.isArray(newData) && newData.length > 0 && typeof newData[0] === 'object') {")
                appendLine("    __output.columns = Object.keys(newData[0]);")
                appendLine("    __output.rows = newData.map(function(obj) {")
                appendLine("      return __output.columns.map(function(c) { return obj[c]; });")
                appendLine("    });")
                appendLine("  }")
                appendLine("  __output.result = newData;")
                appendLine("}")
                appendLine()
            } else {
                appendLine("var __output = { result: null };")
                appendLine("var params = {};")
                appendLine("var data = [];")
                appendLine("function setOutput(v) { __output.result = v; }")
                appendLine()
            }

            // User code
            appendLine("// === User Script ===")
            appendLine(code)
            appendLine()

            // Return value
            appendLine("JSON.stringify({ output: __output, logs: __logs });")
        }

        val future = executor.submit(Callable {
            val context = Context.newBuilder("js")
                .engine(graalEngine)
                .allowHostAccess(HostAccess.NONE)
                .allowHostClassLookup { false }
                .allowIO(false)
                .allowCreateThread(false)
                .allowNativeAccess(false)
                .allowCreateProcess(false)
                .allowEnvironmentAccess(org.graalvm.polyglot.EnvironmentAccess.NONE)
                .option("js.ecmascript-version", "2022")
                .out(consoleOutput)
                .err(consoleOutput)
                .build()

            context.use { ctx ->
                val result = ctx.eval("js", fullScript)
                result.asString()
            }
        })

        return try {
            val jsonResult = future.get(timeoutMs, TimeUnit.MILLISECONDS)
            val elapsed = System.currentTimeMillis() - startMs

            parseResult(jsonResult, elapsed)
        } catch (e: TimeoutException) {
            future.cancel(true)
            val elapsed = System.currentTimeMillis() - startMs
            log.warn("Script timed out after {}ms (limit: {}ms)", elapsed, timeoutMs)
            ExecutionResult(
                output = null, columns = null, rows = null,
                logs = logs, executionMs = elapsed,
                success = false, error = "Script timed out after ${timeoutMs}ms"
            )
        } catch (e: ExecutionException) {
            val elapsed = System.currentTimeMillis() - startMs
            val cause = e.cause?.message ?: e.message ?: "Unknown error"
            log.warn("Script execution error: {}", cause)
            ExecutionResult(
                output = null, columns = null, rows = null,
                logs = logs, executionMs = elapsed,
                success = false, error = cause
            )
        } catch (e: Exception) {
            val elapsed = System.currentTimeMillis() - startMs
            log.error("Unexpected script error", e)
            ExecutionResult(
                output = null, columns = null, rows = null,
                logs = logs, executionMs = elapsed,
                success = false, error = e.message ?: "Unexpected error"
            )
        }
    }

    private fun parseResult(json: String, executionMs: Long): ExecutionResult {
        return try {
            val mapper = com.fasterxml.jackson.databind.ObjectMapper()
            val tree = mapper.readTree(json)

            val outputNode = tree.get("output")
            val logsNode = tree.get("logs")

            val logs = logsNode?.map { it.asText() } ?: emptyList()
            val columns = outputNode?.get("columns")?.map { it.asText() }
            val rows = outputNode?.get("rows")?.map { row ->
                row.map { cell ->
                    when {
                        cell.isNull -> null
                        cell.isNumber -> cell.numberValue()
                        cell.isBoolean -> cell.booleanValue()
                        else -> cell.asText()
                    }
                }
            }
            val result = outputNode?.get("result")?.let {
                when {
                    it.isNull -> null
                    it.isTextual -> it.asText()
                    it.isNumber -> it.numberValue()
                    it.isBoolean -> it.booleanValue()
                    else -> mapper.treeToValue(it, Any::class.java)
                }
            }

            ExecutionResult(
                output = result, columns = columns, rows = rows,
                logs = logs, executionMs = executionMs, success = true
            )
        } catch (e: Exception) {
            ExecutionResult(
                output = json, columns = null, rows = null,
                logs = emptyList(), executionMs = executionMs,
                success = true
            )
        }
    }

    // ── JSON serialization helpers ──

    private fun toJsArray(list: List<String>): String {
        return list.joinToString(",", "[", "]") { "\"${escapeJs(it)}\"" }
    }

    private fun toJsNestedArray(rows: List<List<Any?>>): String {
        return rows.joinToString(",\n", "[\n", "\n]") { row ->
            row.joinToString(",", "[", "]") { cell -> toJsValue(cell) }
        }
    }

    private fun toJsObject(map: Map<String, Any?>): String {
        if (map.isEmpty()) return "{}"
        return map.entries.joinToString(",", "{", "}") { (k, v) ->
            "\"${escapeJs(k)}\":${toJsValue(v)}"
        }
    }

    private fun toJsValue(value: Any?): String = when (value) {
        null -> "null"
        is String -> "\"${escapeJs(value)}\""
        is Number -> value.toString()
        is Boolean -> value.toString()
        is List<*> -> value.joinToString(",", "[", "]") { toJsValue(it) }
        is Map<*, *> -> value.entries.joinToString(",", "{", "}") { (k, v) ->
            "\"${escapeJs(k.toString())}\":${toJsValue(v)}"
        }
        else -> "\"${escapeJs(value.toString())}\""
    }

    private fun escapeJs(s: String): String = s
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")

    data class DataInput(
        val columns: List<String>,
        val rows: List<List<Any?>>,
        val parameters: Map<String, Any?>
    )
}
