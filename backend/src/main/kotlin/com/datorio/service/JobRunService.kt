package com.datorio.service

import com.datorio.model.ReportParameter
import com.datorio.model.WidgetType
import com.datorio.model.dto.JobStatusResponse
import com.datorio.model.dto.JobTaskStatus
import com.datorio.model.dto.RunJobResponse
import com.datorio.repository.ReportWidgetRepository
import com.datorio.repository.UserRepository
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * Starts the job of a RUN_JOB button (an Airflow DAG) with the report parameters as its run
 * configuration, and reports the progress of a run. The job id and the parameter list are read from
 * the saved widget, not from the request, and the job must be listed in datorio.airflow.allowed-dags.
 *
 * Button settings (widget chartConfig): jobId, jobParams (report parameters to send, all when
 * empty), jobUserParam (receives the user name), jobEmailParam (receives the user's email when empty).
 */
@Service
class JobRunService(
    private val widgetRepo: ReportWidgetRepository,
    private val userRepository: UserRepository,
    private val airflowClient: AirflowClient,
    private val auditService: AuditService,
    private val objectMapper: ObjectMapper,
    @Value("\${datorio.airflow.allowed-dags:}") allowedDags: String,
    txManager: PlatformTransactionManager
) {
    private val allowed = allowedDags.split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    private val readTx = TransactionTemplate(txManager).apply { isReadOnly = true }

    private data class PreparedRun(val jobId: String, val conf: Map<String, Any?>)

    fun runJob(reportId: Long, widgetId: Long, values: Map<String, Any?>, username: String): RunJobResponse {
        // Read the widget and the report parameters first, call Airflow outside the transaction.
        val prepared = readTx.execute { prepare(reportId, widgetId, values, username) }!!
        val run = airflowClient.triggerDagRun(prepared.jobId, prepared.conf, "Datorio: $username, report $reportId")
        auditService.log(
            username = username,
            action = "JOB_RUN",
            objectType = "REPORT",
            objectId = reportId,
            details = mapOf("widgetId" to widgetId, "jobId" to prepared.jobId, "runId" to run.runId)
        )
        return RunJobResponse(prepared.jobId, run.runId, run.state)
    }

    /** Progress of a run of the button's job: run state and its steps. */
    fun getJobStatus(reportId: Long, widgetId: Long, runId: String): JobStatusResponse {
        require(runId.isNotBlank()) { "Run id is empty" }
        val jobId = readTx.execute { resolveJob(reportId, widgetId).first }!!
        return toStatus(jobId, airflowClient.getDagRunStatus(jobId, runId))
    }

    private fun prepare(reportId: Long, widgetId: Long, values: Map<String, Any?>, username: String): PreparedRun {
        val (jobId, cfg) = resolveJob(reportId, widgetId)
        val widget = widgetRepo.findById(widgetId).orElseThrow()
        val user = userRepository.findByUsername(username).orElseThrow { NoSuchElementException("User $username not found") }
        val parameters: List<ReportParameter> = widget.report!!.parameters.toList()
        val conf = JobConfBuilder.build(
            parameters = parameters,
            values = values,
            include = names(cfg["jobParams"]),
            userParam = cfg["jobUserParam"]?.toString()?.trim(),
            username = user.username,
            emailParam = cfg["jobEmailParam"]?.toString()?.trim(),
            email = user.email
        )
        return PreparedRun(jobId, conf)
    }

    /** Job id and settings of a RUN_JOB button of the report; refuses other widgets and jobs out of the list. */
    private fun resolveJob(reportId: Long, widgetId: Long): Pair<String, Map<String, Any?>> {
        val widget = widgetRepo.findById(widgetId).orElseThrow { NoSuchElementException("Widget $widgetId not found") }
        val report = widget.report ?: throw NoSuchElementException("Widget $widgetId has no report")
        require(report.id == reportId) { "Widget $widgetId does not belong to report $reportId" }
        require(widget.widgetType == WidgetType.BUTTON) { "Widget $widgetId is not a button" }

        val cfg: Map<String, Any?> = objectMapper.readValue(widget.chartConfig.ifBlank { "{}" })
        require(cfg["buttonType"] == "RUN_JOB") { "Button $widgetId does not start a job" }
        val jobId = cfg["jobId"]?.toString()?.trim().orEmpty()
        require(jobId.isNotEmpty()) { "Button $widgetId has no job id" }
        require(jobId in allowed) { "Job $jobId is not allowed: add it to datorio.airflow.allowed-dags" }
        return jobId to cfg
    }

    /** jobParams may be saved as a list or as text "a, b, c". */
    private fun names(raw: Any?): List<String> = when (raw) {
        null -> emptyList()
        is Collection<*> -> raw.mapNotNull { it?.toString()?.trim() }
        else -> raw.toString().split(',').map { it.trim() }
    }.filter { it.isNotEmpty() }

    companion object {
        private val DONE_TASK_STATES = setOf("success", "failed", "skipped", "upstream_failed", "removed")
        private val FAILED_TASK_STATES = setOf("failed", "upstream_failed")
        private val ACTIVE_TASK_STATES = setOf(
            "running", "queued", "scheduled", "up_for_retry", "up_for_reschedule", "deferred", "restarting"
        )

        /** Steps in start order (not started ones last), done and current step, final state. */
        fun toStatus(jobId: String, run: DagRunStatus): JobStatusResponse {
            val tasks = run.tasks
                .sortedWith(compareBy<TaskInstanceInfo>({ it.startDate == null }, { it.startDate ?: "" }))
                .map { JobTaskStatus(it.taskId, it.label, it.state, it.startDate, it.endDate) }
            val finished = run.state == "success" || run.state == "failed"
            return JobStatusResponse(
                jobId = jobId,
                runId = run.runId,
                state = run.state,
                queuedAt = run.queuedAt,
                startDate = run.startDate,
                endDate = run.endDate,
                tasks = tasks,
                doneTasks = if (run.state == "success") tasks.size else tasks.count { it.state in DONE_TASK_STATES },
                totalTasks = tasks.size,
                currentTask = tasks.firstOrNull { it.state in ACTIVE_TASK_STATES }?.label,
                failedTask = tasks.firstOrNull { it.state in FAILED_TASK_STATES }?.label,
                finished = finished,
                succeeded = run.state == "success"
            )
        }
    }
}
