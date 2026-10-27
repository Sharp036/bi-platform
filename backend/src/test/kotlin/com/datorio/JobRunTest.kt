package com.datorio

import com.datorio.model.*
import com.datorio.repository.ReportWidgetRepository
import com.datorio.repository.UserRepository
import com.datorio.service.*
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.*
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import java.net.InetSocketAddress
import java.time.LocalDate
import java.util.*
import java.util.concurrent.CopyOnWriteArrayList

class JobRunTest {

    private val mapper = jacksonObjectMapper()

    private fun param(name: String, type: ParamType, default: String? = null, order: Int = 0) =
        ReportParameter(name = name, paramType = type, defaultValue = default, sortOrder = order)

    @Nested
    inner class ConfBuilder {

        private val params = listOf(
            param("campaign_code", ParamType.STRING, order = 0),
            param("networks", ParamType.MULTI_SELECT, "RBT", order = 1),
            param("sms_pct", ParamType.NUMBER, "30", order = 2),
            param("sms_cost", ParamType.NUMBER, "7.52", order = 3),
            param("calc_date", ParamType.DATE, "__today__", order = 4),
            param("recipients", ParamType.STRING, order = 5),
            param("created_by", ParamType.STRING, order = 6),
            param("dry", ParamType.BOOLEAN, order = 7)
        )

        private fun build(values: Map<String, Any?>, include: List<String> = emptyList()) = JobConfBuilder.build(
            parameters = params, values = values, include = include,
            userParam = "created_by", username = "ivanov",
            emailParam = "recipients", email = "ivanov@example.ru",
            today = LocalDate.of(2026, 10, 26)
        )

        @Test
        fun `types values and applies report defaults`() {
            val conf = build(mapOf("campaign_code" to " CB1 ", "networks" to "RBT, Leran", "sms_pct" to 25.0, "dry" to "true"))
            assertEquals("CB1", conf["campaign_code"])
            assertEquals(listOf("RBT", "Leran"), conf["networks"])
            assertEquals(25L, conf["sms_pct"])
            assertEquals(7.52, conf["sms_cost"])
            assertEquals("2026-10-26", conf["calc_date"])
            assertEquals(true, conf["dry"])
        }

        @Test
        fun `blank values are not sent`() {
            val conf = build(mapOf("campaign_code" to "", "networks" to "", "sms_pct" to "", "dry" to ""))
            assertFalse("campaign_code" in conf)
            assertFalse("networks" in conf)
            assertFalse("sms_pct" in conf)
            assertFalse("dry" in conf)
        }

        @Test
        fun `user name always wins and email fills an empty field`() {
            val conf = build(mapOf("created_by" to "someone_else", "recipients" to ""))
            assertEquals("ivanov", conf["created_by"])
            assertEquals("ivanov@example.ru", conf["recipients"])
            val own = build(mapOf("recipients" to "boss@example.ru"))
            assertEquals("boss@example.ru", own["recipients"])
        }

        @Test
        fun `include limits the parameters`() {
            val conf = build(mapOf("campaign_code" to "CB1"), include = listOf("campaign_code"))
            assertEquals(setOf("campaign_code", "created_by", "recipients"), conf.keys)
        }

        @Test
        fun `unknown include and bad number are rejected`() {
            assertThrows<IllegalArgumentException> { build(emptyMap(), include = listOf("nope")) }
            assertThrows<IllegalArgumentException> { build(mapOf("sms_pct" to "abc")) }
        }
    }

    @Nested
    inner class Client {

        private var server: HttpServer? = null
        private val tokens = CopyOnWriteArrayList<String>()
        private val runs = CopyOnWriteArrayList<Pair<String?, String>>()
        private val upgrades = CopyOnWriteArrayList<String?>()

        @AfterEach
        fun stop() {
            server?.stop(0)
        }

        private fun start(runStatus: () -> Int, runBody: String): String {
            val s = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
            s.createContext("/auth/token") { ex ->
                upgrades.add(ex.requestHeaders.getFirst("Upgrade"))
                val token = "t${tokens.size + 1}"
                tokens.add(ex.requestBody.readBytes().decodeToString())
                val out = """{"access_token": "$token"}""".toByteArray()
                ex.sendResponseHeaders(201, out.size.toLong())
                ex.responseBody.use { it.write(out) }
            }
            s.createContext("/api/v2/dags/build_x/dagRuns") { ex ->
                upgrades.add(ex.requestHeaders.getFirst("Upgrade"))
                runs.add(ex.requestHeaders.getFirst("Authorization") to ex.requestBody.readBytes().decodeToString())
                val status = runStatus()
                val out = (if (status == 200) runBody else """{"detail": "bad conf"}""").toByteArray()
                ex.sendResponseHeaders(status, out.size.toLong())
                ex.responseBody.use { it.write(out) }
            }
            s.start()
            server = s
            return "http://127.0.0.1:${s.address.port}/"
        }

        @Test
        fun `logs in once and triggers with logical_date null`() {
            val url = start({ 200 }, """{"dag_run_id": "manual__1", "state": "queued"}""")
            val client = AirflowClient(url, "svc", "secret", 5)
            val run = client.triggerDagRun("build_x", mapOf("networks" to listOf("RBT")), "note")
            client.triggerDagRun("build_x", emptyMap())
            assertEquals(DagRunInfo("manual__1", "queued"), run)
            assertEquals(1, tokens.size)
            assertEquals(mapOf("username" to "svc", "password" to "secret"), mapper.readValue<Map<String, Any?>>(tokens[0]))
            val (auth, body) = runs[0]
            assertEquals("Bearer t1", auth)
            val sent: Map<String, Any?> = mapper.readValue(body)
            assertTrue(sent.containsKey("logical_date") && sent["logical_date"] == null)
            assertEquals(mapOf("networks" to listOf("RBT")), sent["conf"])
            // No h2c upgrade: the uvicorn server of Airflow loses the body of such a request.
            assertEquals(listOf<String?>(null, null, null), upgrades.toList())
        }

        @Test
        fun `logs in again after 401`() {
            var calls = 0
            val url = start({ if (calls++ == 0) 401 else 200 }, """{"dag_run_id": "manual__2"}""")
            val run = AirflowClient(url, "svc", "secret", 5).triggerDagRun("build_x", emptyMap())
            assertEquals("manual__2", run.runId)
            assertEquals(2, tokens.size)
            assertEquals("Bearer t2", runs[1].first)
        }

        @Test
        fun `client error carries the airflow detail`() {
            val url = start({ 400 }, "")
            val e = assertThrows<IllegalArgumentException> {
                AirflowClient(url, "svc", "secret", 5).triggerDagRun("build_x", emptyMap())
            }
            assertTrue(e.message!!.contains("bad conf"))
        }

        @Test
        fun `not configured client refuses`() {
            assertFalse(AirflowClient("", "", "", 5).isConfigured())
            assertThrows<IllegalStateException> { AirflowClient("", "", "", 5).triggerDagRun("build_x", emptyMap()) }
        }

        @Test
        fun `reads the run and its tasks with the run id encoded`() {
            val paths = CopyOnWriteArrayList<String>()
            val s = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
            s.createContext("/auth/token") { ex ->
                val out = """{"access_token": "t1"}""".toByteArray()
                ex.sendResponseHeaders(201, out.size.toLong())
                ex.responseBody.use { it.write(out) }
            }
            s.createContext("/api/v2/dags/build_x/dagRuns/") { ex ->
                paths.add(ex.requestURI.rawPath)
                val body = if (ex.requestURI.rawPath.endsWith("/taskInstances")) {
                    """{"task_instances": [
                        {"task_id": "send_files", "task_display_name": "Files", "state": "running", "start_date": "2026-10-27T18:36:00Z", "end_date": null},
                        {"task_id": "prepare_run", "task_display_name": "prepare_run", "state": "success", "start_date": "2026-10-27T18:35:00Z", "end_date": "2026-10-27T18:35:10Z"},
                        {"task_id": "finish_run", "task_display_name": "", "state": null, "start_date": null, "end_date": null}
                    ], "total_entries": 3}"""
                } else {
                    """{"dag_run_id": "manual__x", "state": "running", "queued_at": "2026-10-27T18:34:47Z", "start_date": "2026-10-27T18:34:50Z", "end_date": null}"""
                }
                val out = body.toByteArray()
                ex.sendResponseHeaders(200, out.size.toLong())
                ex.responseBody.use { it.write(out) }
            }
            s.start()
            server = s
            val status = AirflowClient("http://127.0.0.1:${s.address.port}", "svc", "secret", 5)
                .getDagRunStatus("build_x", "manual__2026-10-27T18:34:47.579094+00:00")
            assertEquals("running", status.state)
            assertEquals(listOf("Files", "prepare_run", "finish_run"), status.tasks.map { it.label })
            assertEquals(
                "/api/v2/dags/build_x/dagRuns/manual__2026-10-27T18%3A34%3A47.579094%2B00%3A00",
                paths[0]
            )
            assertTrue(paths[1].endsWith("%2B00%3A00/taskInstances"))
        }
    }

    @Nested
    inner class Progress {

        private fun task(id: String, state: String?, start: String?) = TaskInstanceInfo(id, id, state, start, null)

        @Test
        fun `running run counts done steps and names the current one`() {
            val run = DagRunStatus("r1", "running", null, "t0", null, listOf(
                task("send_files", null, null),
                task("build_audience", "running", "2026-10-27T18:35:10Z"),
                task("prepare_run", "success", "2026-10-27T18:35:00Z"),
                task("mark_failed", null, null)
            ))
            val s = JobRunService.toStatus("build_x", run)
            assertEquals(listOf("prepare_run", "build_audience", "send_files", "mark_failed"), s.tasks.map { it.taskId })
            assertEquals(1, s.doneTasks)
            assertEquals(4, s.totalTasks)
            assertEquals("build_audience", s.currentTask)
            assertFalse(s.finished)
        }

        @Test
        fun `finished runs report success or the failed step`() {
            val ok = JobRunService.toStatus("build_x", DagRunStatus("r1", "success", null, null, null, listOf(
                task("prepare_run", "success", "a"), task("mark_failed", "skipped", null)
            )))
            assertTrue(ok.finished && ok.succeeded)
            assertEquals(2, ok.doneTasks)
            val failed = JobRunService.toStatus("build_x", DagRunStatus("r2", "failed", null, null, null, listOf(
                task("prepare_run", "failed", "a"), task("build_audience", "upstream_failed", null),
                task("mark_failed", "success", "b")
            )))
            assertTrue(failed.finished && !failed.succeeded)
            assertEquals("prepare_run", failed.failedTask)
            assertEquals(3, failed.doneTasks)
        }
    }

    @Nested
    inner class Service {

        private val widgetRepo: ReportWidgetRepository = mock()
        private val userRepo: UserRepository = mock()
        private val client: AirflowClient = mock()
        private val audit: AuditService = mock()
        private val txManager: PlatformTransactionManager = mock {
            on { getTransaction(anyOrNull()) } doReturn SimpleTransactionStatus()
        }

        private fun service(allowed: String = "build_x") =
            JobRunService(widgetRepo, userRepo, client, audit, mapper, allowed, txManager)

        private fun widget(config: String, type: WidgetType = WidgetType.BUTTON, reportId: Long = 5): ReportWidget {
            val report = Report(id = reportId, name = "r")
            report.parameters.add(ReportParameter(report = report, name = "campaign_code", paramType = ParamType.STRING))
            report.parameters.add(ReportParameter(report = report, name = "recipients", paramType = ParamType.STRING))
            return ReportWidget(id = 7, report = report, widgetType = type, chartConfig = config)
        }

        private val runJob = """{"buttonType": "RUN_JOB", "jobId": "build_x", "jobUserParam": "created_by", "jobEmailParam": "recipients"}"""

        @Test
        fun `starts the job of the button with the report values`() {
            whenever(widgetRepo.findById(7)).thenReturn(Optional.of(widget(runJob)))
            whenever(userRepo.findByUsername("ivanov")).thenReturn(
                Optional.of(User(username = "ivanov", email = "ivanov@example.ru", passwordHash = "x"))
            )
            whenever(client.triggerDagRun(any(), any(), anyOrNull())).thenReturn(DagRunInfo("manual__1", "queued"))

            val res = service().runJob(5, 7, mapOf("campaign_code" to "CB1"), "ivanov")

            assertEquals("manual__1", res.runId)
            verify(client).triggerDagRun(
                eq("build_x"),
                eq(mapOf("campaign_code" to "CB1", "created_by" to "ivanov", "recipients" to "ivanov@example.ru")),
                anyOrNull()
            )
            verify(audit).log(eq("ivanov"), eq("JOB_RUN"), eq("REPORT"), eq(5L), any(), anyOrNull())
        }

        @Test
        fun `refuses foreign report, other buttons and jobs out of the list`() {
            whenever(widgetRepo.findById(7)).thenReturn(Optional.of(widget(runJob, reportId = 6)))
            assertThrows<IllegalArgumentException> { service().runJob(5, 7, emptyMap(), "ivanov") }

            whenever(widgetRepo.findById(7)).thenReturn(Optional.of(widget("""{"buttonType": "URL"}""")))
            assertThrows<IllegalArgumentException> { service().runJob(5, 7, emptyMap(), "ivanov") }

            whenever(widgetRepo.findById(7)).thenReturn(Optional.of(widget(runJob, type = WidgetType.TEXT)))
            assertThrows<IllegalArgumentException> { service().runJob(5, 7, emptyMap(), "ivanov") }

            whenever(widgetRepo.findById(7)).thenReturn(Optional.of(widget(runJob)))
            assertThrows<IllegalArgumentException> { service(allowed = "other_dag").runJob(5, 7, emptyMap(), "ivanov") }
            assertThrows<IllegalArgumentException> { service(allowed = "other_dag").getJobStatus(5, 7, "manual__1") }

            whenever(widgetRepo.findById(7)).thenReturn(Optional.of(widget("""{"buttonType": "URL"}""")))
            assertThrows<IllegalArgumentException> { service().getJobStatus(5, 7, "manual__1") }

            verifyNoInteractions(client)
        }
    }
}
