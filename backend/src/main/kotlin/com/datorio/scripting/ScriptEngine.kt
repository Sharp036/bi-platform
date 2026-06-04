package com.datorio.scripting

import com.fasterxml.jackson.databind.ObjectMapper
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Engine
import org.graalvm.polyglot.EnvironmentAccess
import org.graalvm.polyglot.HostAccess
import org.graalvm.polyglot.PolyglotAccess
import org.graalvm.polyglot.PolyglotException
import org.graalvm.polyglot.ResourceLimits
import org.graalvm.polyglot.io.IOAccess
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value as SpringValue
import org.springframework.stereotype.Component
import java.util.concurrent.Callable
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/**
 * Sandboxed JavaScript execution engine for untrusted, user-supplied chart-transform
 * scripts, built on GraalJS (org.graalvm.polyglot 24.0.2, Community edition).
 *
 * Threat model: EVERY script is treated as hostile. The guest must not be able to reach
 * any Java type, the filesystem, the network, processes, threads, the environment, or
 * another polyglot language, and must not be able to hang or starve the host.
 *
 * Controls implemented here:
 *  - Host access fully denied (HostAccess.NONE, no class lookup, no polyglot, no IO,
 *    no native, no process, no thread, no environment, allowAllAccess=false).
 *  - One shared Engine (warm startup) but a brand-new Context per execution, closed after
 *    each run -> no state leakage or thread-safety issues across requests/users.
 *  - Wall-clock timeout enforced by running eval on a worker thread and forcibly cancelling
 *    via Context.close(cancelIfExecuting=true) from the calling thread. This kills tight
 *    CPU loops such as while(true){} that ignore Thread.interrupt().
 *  - Statement-count limit via ResourceLimits (available on Community GraalVM).
 *  - Input passed in as an inert JSON string (parsed inside the guest), never as live
 *    mutable Java collections; output read back as a JSON string and size-capped.
 *  - Script source length capped; PolyglotException messages sanitised before leaving
 *    the host.
 *
 * RESIDUAL RISK - HARD MEMORY LIMITS (read before relying on this in production):
 * Per-context heap limits (sandbox.MaxHeapMemory) and the strong SandboxPolicy levels
 * (CONSTRAINED/ISOLATED/UNTRUSTED) require Oracle GraalVM together with the
 * truffle-enterprise runtime. This build uses the Community polyglot artifacts on a stock
 * JDK, so those limits are NOT enforceable here. A determined allocation bomb (e.g. a
 * doubling string) can exhaust the JVM heap in very few statements, before the statement
 * limit or wall-clock timeout fires. The statement limit, timeout, input-length cap and
 * output cap below are compensating controls only. To close the memory gap you must EITHER
 * run on Oracle GraalVM (this class auto-detects truffle-enterprise and applies a heap cap
 * when present) OR run the BI process in a restricted container: a dedicated, memory-capped
 * (cgroup) JVM, non-root, read-only filesystem, and no outbound network. Do not expose this
 * endpoint to untrusted users without that containment.
 */
@Component
class ScriptEngine(
    @SpringValue("\${datorio.scripting.timeout-ms:5000}") private val timeoutMs: Long,
    @SpringValue("\${datorio.scripting.max-statements:100000}") private val maxStatements: Long,
    @SpringValue("\${datorio.scripting.max-memory-mb:64}") private val maxMemoryMb: Long,
    @SpringValue("\${datorio.scripting.max-output-bytes:5242880}") private val maxOutputBytes: Long,
    @SpringValue("\${datorio.scripting.max-script-length:100000}") private val maxScriptLength: Int
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val mapper = ObjectMapper()

    // Single shared engine -> warm startup. Contexts are created per execution (see execute()).
    private val graalEngine: Engine = Engine.newBuilder("js")
        .option("engine.WarnInterpreterOnly", "false")
        .build()

    /**
     * Deny-all host access. Built from an empty builder rather than the HostAccess.NONE
     * singleton on purpose: NONE leaves its internal sets null, which trips a NullPointer
     * exception in HostAccess.equals when a second Context is created on a shared Engine
     * (GraalVM compares the per-context host-access config against the engine-cached one).
     * An empty builder denies exactly the same things (no constructors, methods, fields,
     * implementations, or target mappings are allowlisted) but with non-null empty sets, so
     * the comparison is safe. Reused as a single immutable instance across all contexts.
     */
    private val deniedHostAccess: HostAccess = HostAccess.newBuilder().build()

    // Statement-count guard. Counts executed statements; on overrun the guest is terminated
    // with a resource-exhausted PolyglotException. Available on Community GraalVM.
    private val resourceLimits: ResourceLimits = ResourceLimits.newBuilder()
        .statementLimit(maxStatements, null)
        .build()

    /**
     * Whether per-context heap limits are enforceable on this runtime. True only on Oracle
     * GraalVM with truffle-enterprise; false on Community (the case for this build). Probed
     * once at startup so we never silently no-op: the result is logged and the gap is
     * surfaced rather than hidden.
     */
    private val memoryLimitSupported: Boolean = probeMemoryLimitSupport()

    // Dedicated pool for timeout enforcement. Daemon threads so a stuck guest (until it is
    // cancelled) never blocks JVM shutdown.
    private val executor: ExecutorService = Executors.newCachedThreadPool { r ->
        Thread(r, "script-exec").apply { isDaemon = true }
    }

    init {
        if (memoryLimitSupported) {
            log.info(
                "ScriptEngine: Oracle GraalVM sandbox detected - applying {}MB per-context heap limit, " +
                    "statement limit {}, timeout {}ms.",
                maxMemoryMb, maxStatements, timeoutMs
            )
        } else {
            log.warn(
                "ScriptEngine: running on Community GraalVM - per-context HEAP limits are NOT enforceable. " +
                    "Compensating controls active: statement limit {}, wall-clock timeout {}ms, " +
                    "script-length cap {} chars, output cap {} bytes. Run this process in a memory-capped, " +
                    "non-root, read-only, network-isolated container to contain memory-exhaustion attacks.",
                maxStatements, timeoutMs, maxScriptLength, maxOutputBytes
            )
        }
    }

    data class ExecutionResult(
        val output: Any?,
        val columns: List<String>?,
        val rows: List<List<Any?>>?,
        val logs: List<String>,
        val executionMs: Long,
        val success: Boolean,
        val error: String? = null,
        val timedOut: Boolean = false
    )

    /**
     * Execute a script with optional data input and library code prepended.
     *
     * @param code        The JavaScript code to execute (untrusted)
     * @param input       Data input: columns, rows, parameters
     * @param libraryCode Prepended library functions (also untrusted)
     * @param username    Acting user, used only for server-side log correlation (RBAC)
     */
    fun execute(
        code: String,
        input: DataInput? = null,
        libraryCode: String? = null,
        username: String? = null
    ): ExecutionResult {
        val startMs = System.currentTimeMillis()

        // Defence in depth: cap the total source length before anything is compiled. Caps
        // parse-time/AST blow-ups and is a cheap first line of defence against memory abuse.
        val sourceLength = code.length.toLong() + (libraryCode?.length?.toLong() ?: 0L)
        if (sourceLength > maxScriptLength) {
            return failure(
                "Script exceeds maximum allowed length of $maxScriptLength characters",
                System.currentTimeMillis() - startMs
            )
        }

        val fullScript = buildScript(code, input, libraryCode)

        // Serialise the input to an inert JSON string. It is handed to the guest as a string
        // binding and parsed there with JSON.parse - never as a live mutable Java collection
        // or any object carrying callable host methods.
        val inputJson: String = if (input != null) {
            mapper.writeValueAsString(
                mapOf(
                    "columns" to input.columns,
                    "rows" to input.rows,
                    "parameters" to input.parameters
                )
            )
        } else {
            "null"
        }

        // Build the Context on THIS thread so the watchdog below can cancel it. (The old code
        // built it inside the worker thread, which left no handle to interrupt a runaway loop.)
        val context = buildContext()
        var forciblyClosed = false

        val future = executor.submit(Callable {
            context.getBindings("js").putMember("__INPUT_JSON__", inputJson)
            context.eval("js", fullScript).asString()
        })

        return try {
            val jsonResult = future.get(timeoutMs, TimeUnit.MILLISECONDS)
            val elapsed = System.currentTimeMillis() - startMs

            // Output cap: reject oversized results before parsing / returning them to the API
            // or persisting them. Measured as UTF-8 byte length of the guest's JSON output.
            val outputBytes = jsonResult.toByteArray(Charsets.UTF_8).size.toLong()
            if (outputBytes > maxOutputBytes) {
                log.warn(
                    "Script output {} bytes exceeds cap {} bytes (user={})",
                    outputBytes, maxOutputBytes, username
                )
                return failure(
                    "Script output exceeds maximum allowed size of $maxOutputBytes bytes",
                    elapsed
                )
            }

            parseResult(jsonResult, elapsed)
        } catch (e: TimeoutException) {
            // Forcibly cancel the running guest. close(cancelIfExecuting=true) interrupts the
            // guest execution on the worker thread and blocks until it has stopped - this is
            // what actually kills a CPU-bound while(true){} that ignores Thread.interrupt().
            forciblyClosed = true
            try {
                context.close(true)
            } catch (ce: Exception) {
                log.debug("Error while force-closing timed-out context", ce)
            }
            future.cancel(true)
            val elapsed = System.currentTimeMillis() - startMs
            log.warn("Script timed out after {}ms (limit {}ms, user={})", elapsed, timeoutMs, username)
            ExecutionResult(
                output = null, columns = null, rows = null,
                logs = emptyList(), executionMs = elapsed,
                success = false, error = "Script timed out after ${timeoutMs}ms", timedOut = true
            )
        } catch (e: ExecutionException) {
            val elapsed = System.currentTimeMillis() - startMs
            // Full detail server-side only; sanitised message to the caller.
            log.warn("Script execution failed (user={})", username, e.cause ?: e)
            failure(sanitize(e.cause), elapsed)
        } catch (e: Exception) {
            val elapsed = System.currentTimeMillis() - startMs
            log.error("Unexpected script error (user={})", username, e)
            failure("Script execution failed", elapsed)
        } finally {
            if (!forciblyClosed) {
                try {
                    context.close()
                } catch (ce: Exception) {
                    log.debug("Error closing context", ce)
                }
            }
        }
    }

    /** Build a fully locked-down Context. A new instance is created for every execution. */
    private fun buildContext(): Context {
        val builder = Context.newBuilder("js")
            .engine(graalEngine)
            // ── Host isolation: deny everything by default ──
            .allowAllAccess(false)
            .allowHostAccess(deniedHostAccess)         // no field/method access on host objects
            .allowHostClassLookup { false }            // blocks Java.type(...)
            .allowHostClassLoading(false)
            .allowPolyglotAccess(PolyglotAccess.NONE)  // no eval into other guest languages
            .allowIO(IOAccess.NONE)                    // no filesystem / sockets
            .allowCreateThread(false)
            .allowCreateProcess(false)
            .allowNativeAccess(false)
            .allowEnvironmentAccess(EnvironmentAccess.NONE)
            // ── Resource guards ──
            .resourceLimits(resourceLimits)
            .option("js.ecmascript-version", "2022")
            // Note: removing the host package-namespace globals (java, javax, Packages, ...)
            // would require the experimental option js.java-package-globals, which GraalVM
            // explicitly forbids in production. We do not enable experimental options. Those
            // globals are already inert here (host access and class lookup are denied), and
            // any class name they would surface in an error is scrubbed by redactGuestMessage.

        // Heap cap - only meaningful on Oracle GraalVM + truffle-enterprise. Probed once at
        // startup; never silently applied where it would be ignored.
        if (memoryLimitSupported) {
            builder.option("sandbox.MaxHeapMemory", "${maxMemoryMb}MB")
        }

        return builder.build()
    }

    /**
     * Probe once whether the runtime honours per-context heap limits. On Community GraalVM
     * the sandbox.MaxHeapMemory option is rejected at build time, so this returns false and
     * the gap is logged and compensated (see class docs). On Oracle GraalVM it returns true.
     */
    private fun probeMemoryLimitSupport(): Boolean = try {
        Context.newBuilder("js")
            .engine(graalEngine)
            .allowHostAccess(deniedHostAccess)
            .option("sandbox.MaxHeapMemory", "16MB")
            .build()
            .use { true }
    } catch (t: Throwable) {
        false
    }

    /**
     * Translate a host-side failure into a message safe to return to the API. Never leaks
     * host stack traces, file paths, or class names. Guest (script-authored) messages are
     * passed through because they belong to the caller's own script; everything else is
     * reduced to a generic message.
     */
    private fun sanitize(cause: Throwable?): String = when {
        cause is PolyglotException && cause.isResourceExhausted ->
            "Script exceeded its resource limit (statements/memory)"
        cause is PolyglotException && cause.isCancelled ->
            "Script was cancelled"
        cause is PolyglotException && cause.isInterrupted ->
            "Script was interrupted"
        // A guest-thrown error (syntax error, ReferenceError, explicit throw, etc.). Useful to
        // return to the script author for debugging, but GraalJS-authored messages such as
        // "Access to host class java.lang.Runtime is not allowed" echo host class names. Redact
        // any message that references a host package so no class name reaches the API.
        cause is PolyglotException && cause.isGuestException ->
            redactGuestMessage(cause.message)
        // Host/internal errors: never expose details.
        else -> "Script execution failed"
    }

    private val hostPackagePrefixes = listOf(
        "java.", "javax.", "jdk.", "sun.", "com.sun.", "com.oracle", "org.graalvm", "com.datorio"
    )

    private fun redactGuestMessage(raw: String?): String {
        val msg = (raw ?: "Script error").substringBefore("\n").take(500)
        return if (hostPackagePrefixes.any { msg.contains(it, ignoreCase = true) }) {
            "Access to host functionality is not allowed"
        } else {
            msg
        }
    }

    private fun failure(message: String, elapsedMs: Long) = ExecutionResult(
        output = null, columns = null, rows = null,
        logs = emptyList(), executionMs = elapsedMs,
        success = false, error = message
    )

    /**
     * Assemble the guest source: console shim, optional library code, the data-wiring
     * scaffold (fed from the inert __INPUT_JSON__ string binding), the user code, and a
     * trailing JSON.stringify of the result so the host reads back only a string.
     */
    private fun buildScript(code: String, input: DataInput?, libraryCode: String?): String = buildString {
        // Console capture into an in-guest array (returned via __logs).
        appendLine("var __logs = [];")
        appendLine("var console = { log: function() { __logs.push(Array.from(arguments).join(' ')); } };")
        appendLine("console.warn = console.log;")
        appendLine("console.error = console.log;")
        appendLine("console.info = console.log;")
        appendLine()

        if (!libraryCode.isNullOrBlank()) {
            appendLine("// === Library ===")
            appendLine(libraryCode)
            appendLine()
        }

        if (input != null) {
            appendLine("// === Input Data (parsed from inert JSON binding) ===")
            appendLine("var __INPUT = JSON.parse(__INPUT_JSON__);")
            appendLine("var __inputColumns = __INPUT.columns;")
            appendLine("var __inputRows = __INPUT.rows;")
            appendLine("var params = __INPUT.parameters;")
            appendLine()
            appendLine("var data = __inputRows.map(function(row) {")
            appendLine("  var obj = {};")
            appendLine("  __inputColumns.forEach(function(col, i) { obj[col] = row[i]; });")
            appendLine("  return obj;")
            appendLine("});")
            appendLine()
            appendLine("var __output = { columns: __inputColumns, rows: __inputRows, result: null };")
            appendLine()
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

        appendLine("// === User Script ===")
        appendLine(code)
        appendLine()

        appendLine("JSON.stringify({ output: __output, logs: __logs });")
    }

    private fun parseResult(json: String, executionMs: Long): ExecutionResult {
        return try {
            val tree = mapper.readTree(json)
            val outputNode = tree.get("output")
            val logsNode = tree.get("logs")

            val logs = logsNode?.map { it.asText() } ?: emptyList()
            val columns = outputNode?.get("columns")?.takeIf { !it.isNull }?.map { it.asText() }
            val rows = outputNode?.get("rows")?.takeIf { !it.isNull }?.map { row ->
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
            // Output was not the JSON envelope we expect; return the raw string but do not fail.
            ExecutionResult(
                output = json, columns = null, rows = null,
                logs = emptyList(), executionMs = executionMs, success = true
            )
        }
    }

    data class DataInput(
        val columns: List<String>,
        val rows: List<List<Any?>>,
        val parameters: Map<String, Any?>
    )
}
