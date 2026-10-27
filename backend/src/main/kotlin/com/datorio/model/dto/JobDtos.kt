package com.datorio.model.dto

/** Body of POST /reports/{reportId}/widgets/{widgetId}/run-job: the parameter values the report shows. */
data class RunJobRequest(
    val parameters: Map<String, Any?> = emptyMap()
)

/** A job run accepted by the job runner. */
data class RunJobResponse(
    val jobId: String,
    val runId: String,
    val state: String?
)

/** One step (task) of a job run. */
data class JobTaskStatus(
    val taskId: String,
    val label: String,
    val state: String?,
    val startDate: String?,
    val endDate: String?
)

/**
 * State of a job run for the progress of a RUN_JOB button: the run state, its steps in start order,
 * how many steps are over, the current step and whether the run is over and succeeded.
 */
data class JobStatusResponse(
    val jobId: String,
    val runId: String,
    val state: String?,
    val queuedAt: String?,
    val startDate: String?,
    val endDate: String?,
    val tasks: List<JobTaskStatus>,
    val doneTasks: Int,
    val totalTasks: Int,
    val currentTask: String?,
    val failedTask: String?,
    val finished: Boolean,
    val succeeded: Boolean
)
