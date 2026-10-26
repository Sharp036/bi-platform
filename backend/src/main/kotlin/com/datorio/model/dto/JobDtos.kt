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
