package com.datorio.scripting

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Timeout
import java.util.concurrent.TimeUnit

/**
 * Security and functional tests for the sandboxed JS engine.
 *
 * The adversarial cases below represent hostile user scripts that MUST all be blocked or
 * fail safely. Positive cases prove legitimate chart-transform scripts still work.
 *
 * Notes on limits used here:
 *  - A short 1500ms timeout keeps the infinite-loop test fast.
 *  - A small output cap (50 KB) and script-length cap (5000 chars) exercise the DoS guards
 *    without allocating dangerous amounts of memory in CI.
 */
class ScriptEngineTest {

    private fun engine(
        timeoutMs: Long = 1500,
        maxStatements: Long = 10_000_000,
        maxOutputBytes: Long = 50_000,
        maxScriptLength: Int = 5_000,
        maxConcurrent: Int = 8
    ) = ScriptEngine(
        timeoutMs = timeoutMs,
        maxStatements = maxStatements,
        maxMemoryMb = 64,
        maxOutputBytes = maxOutputBytes,
        maxScriptLength = maxScriptLength,
        maxConcurrent = maxConcurrent
    )

    private fun assertBlocked(code: String, msg: String = "expected script to be blocked") {
        val r = engine().execute(code)
        assertFalse(r.success, "$msg, but it succeeded with output=${r.output}")
        // Never leak host internals to the caller.
        r.error?.let { assertNoHostLeak(it) }
    }

    private fun assertNoHostLeak(error: String) {
        val leaks = listOf(
            "java.", "org.graalvm", "com.datorio", "com.oracle",
            ".kt:", ".java:", "at com.", "at org.", "at java.",
            "ProcessBuilder", "ClassNotFoundException", "/home/", "C:\\"
        )
        leaks.forEach { needle ->
            assertFalse(
                error.contains(needle, ignoreCase = true),
                "error message leaked host internals ('$needle'): $error"
            )
        }
    }

    // ────────────────────────────────────────────────────────────
    //  ADVERSARIAL: host / Java reach-out
    // ────────────────────────────────────────────────────────────

    @Test
    fun `Java type lookup to run a process is blocked`() {
        assertBlocked("setOutput(Java.type('java.lang.Runtime').getRuntime().exec('id'));")
    }

    @Test
    fun `ProcessBuilder is unreachable`() {
        assertBlocked("var p = new java.lang.ProcessBuilder(['id']); p.start();")
    }

    @Test
    fun `System exit is unreachable`() {
        // If this were reachable it would kill the JVM and the test runner.
        assertBlocked("Java.type('java.lang.System').exit(1);")
    }

    @Test
    fun `class loader and reflection are unreachable`() {
        assertBlocked("setOutput(Java.type('java.lang.Class').forName('java.lang.Runtime'));")
    }

    @Test
    fun `reading a file is blocked`() {
        assertBlocked(
            "var f = Java.type('java.nio.file.Files'); " +
                "setOutput(f.readString(Java.type('java.nio.file.Paths').get('/etc/passwd')));"
        )
    }

    @Test
    fun `opening a socket is blocked`() {
        assertBlocked("var s = new (Java.type('java.net.Socket'))('example.com', 80);")
    }

    @Test
    fun `creating a thread is blocked`() {
        assertBlocked(
            "var t = new (Java.type('java.lang.Thread'))(function(){}); t.start();"
        )
    }

    @Test
    fun `polyglot eval into another language is blocked`() {
        // Polyglot access is NONE; Polyglot.eval must not exist / must fail.
        assertBlocked("Polyglot.eval('python', 'import os; os.system(\"id\")');")
    }

    @Test
    fun `accessing the Graal context bindings object is blocked`() {
        assertBlocked("setOutput(Java.type('org.graalvm.polyglot.Context'));")
    }

    // ────────────────────────────────────────────────────────────
    //  ADVERSARIAL: DoS
    // ────────────────────────────────────────────────────────────

    @Test
    @Timeout(value = 15, unit = TimeUnit.SECONDS) // suite-level guard: the engine must kill it well before this
    fun `infinite loop is killed by the timeout`() {
        val start = System.currentTimeMillis()
        val r = engine(timeoutMs = 1000).execute("while (true) {}")
        val elapsed = System.currentTimeMillis() - start

        assertFalse(r.success, "infinite loop should not succeed")
        assertTrue(r.timedOut, "infinite loop should be reported as timed out")
        // It must actually be cancelled, not merely time out the future while the CPU keeps spinning.
        assertTrue(elapsed < 10_000, "engine took too long ($elapsed ms) to cancel the loop")
    }

    @Test
    @Timeout(value = 15, unit = TimeUnit.SECONDS)
    fun `tight allocation loop does not hang forever`() {
        // String/array growth bomb. On Community GraalVM there is no hard heap cap, so the
        // guaranteed containment is the wall-clock timeout: the run must terminate (timeout or
        // resource-exhausted), never return a successful giant payload.
        val r = engine(timeoutMs = 1000).execute(
            "var a = []; while (true) { a.push(new Array(1000).fill(0)); }"
        )
        assertFalse(r.success, "allocation loop must not succeed")
    }

    @Test
    fun `oversized result is rejected by the output cap`() {
        // ~1 MB string, well over the 50 KB test cap.
        val r = engine(maxOutputBytes = 50_000)
            .execute("setOutput(new Array(1000000).fill('x').join(''));")
        assertFalse(r.success, "oversized output must be rejected")
        assertTrue(
            r.error?.contains("maximum allowed size", ignoreCase = true) == true,
            "expected output-size rejection, got: ${r.error}"
        )
    }

    @Test
    @Timeout(value = 20, unit = TimeUnit.SECONDS)
    fun `concurrency limit rejects extra executions`() {
        // maxConcurrent=1: of two scripts fired at once, one takes the only slot (and is killed
        // by its 2s timeout), the other must be rejected immediately as busy (tryAcquire fails).
        val eng = engine(timeoutMs = 2000, maxConcurrent = 1)
        val results = java.util.Collections.synchronizedList(mutableListOf<ScriptEngine.ExecutionResult>())
        val threads = (1..2).map {
            Thread { results.add(eng.execute("while (true) {}")) }.apply { isDaemon = true }
        }
        threads.forEach { it.start() }
        threads.forEach { it.join(15_000) }

        assertEquals(2, results.size, "both calls should have returned")
        assertTrue(
            results.any { !it.success && it.error?.contains("busy", ignoreCase = true) == true },
            "with maxConcurrent=1 one of two concurrent runs must be rejected as busy; got ${results.map { it.error }}"
        )
    }

    @Test
    fun `over-long script source is rejected before execution`() {
        val longCode = "var x = 1;".repeat(1000) // > 5000 char test cap
        val r = engine(maxScriptLength = 5_000).execute(longCode)
        assertFalse(r.success)
        assertTrue(
            r.error?.contains("maximum allowed length", ignoreCase = true) == true,
            "expected script-length rejection, got: ${r.error}"
        )
    }

    // ────────────────────────────────────────────────────────────
    //  POSITIVE: legitimate chart transforms still work
    // ────────────────────────────────────────────────────────────

    @Test
    fun `benign transform filters and maps rows`() {
        val input = ScriptEngine.DataInput(
            columns = listOf("region", "amount"),
            rows = listOf(
                listOf("North", 100),
                listOf("South", 250),
                listOf("North", 50)
            ),
            parameters = mapOf("threshold" to 60)
        )
        val code = """
            var threshold = params.threshold;
            var filtered = data
              .filter(function(r) { return r.amount >= threshold; })
              .map(function(r) { return { region: r.region, amount: r.amount * 2 }; });
            setOutput(filtered);
        """.trimIndent()

        val r = engine().execute(code, input)

        assertTrue(r.success, "benign transform should succeed: ${r.error}")
        assertEquals(listOf("region", "amount"), r.columns)
        assertNotNull(r.rows)
        // North/50 (below threshold) dropped -> 2 rows remain.
        assertEquals(2, r.rows!!.size)
        assertEquals(200, (r.rows!![0][1] as Number).toInt())
        assertEquals(500, (r.rows!![1][1] as Number).toInt())
    }

    @Test
    fun `console log output is captured`() {
        val r = engine().execute("console.log('hello', 'world'); setOutput(42);")
        assertTrue(r.success)
        assertEquals(42, (r.output as Number).toInt())
        assertTrue(r.logs.any { it.contains("hello world") }, "logs: ${r.logs}")
    }

    @Test
    fun `standard JS builtins (JSON, Math) are available`() {
        val r = engine().execute("setOutput(Math.round(JSON.parse('[3.7]')[0]));")
        assertTrue(r.success, r.error)
        assertEquals(4, (r.output as Number).toInt())
    }

    @Test
    fun `a guest syntax error fails safely without leaking host internals`() {
        val r = engine().execute("this is not valid javascript @@@")
        assertFalse(r.success)
        r.error?.let { assertNoHostLeak(it) }
    }

    @Test
    fun `contexts do not leak state across executions`() {
        val eng = engine()
        eng.execute("globalThis.__leak = 'secret'; setOutput(1);")
        val r = eng.execute("setOutput(typeof globalThis.__leak);")
        assertTrue(r.success, r.error)
        assertEquals("undefined", r.output)
    }
}
