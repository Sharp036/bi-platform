package com.datorio.controller

import com.datorio.model.dto.RunJobRequest
import com.datorio.model.dto.RunJobResponse
import com.datorio.repository.UserRepository
import com.datorio.service.JobRunService
import com.datorio.service.ObjectPermissionService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

/** RUN_JOB buttons: start the job of a button with the parameter values of the report. */
@RestController
@RequestMapping("/reports")
class JobRunController(
    private val jobRunService: JobRunService,
    private val userRepository: UserRepository,
    private val objectPermissionService: ObjectPermissionService
) {

    @PostMapping("/{reportId}/widgets/{widgetId}/run-job")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun runJob(
        @PathVariable reportId: Long,
        @PathVariable widgetId: Long,
        @RequestBody(required = false) request: RunJobRequest?,
        auth: Authentication
    ): ResponseEntity<RunJobResponse> {
        // Same access rule as opening the report.
        val canSeeAll = auth.authorities.any { it.authority in listOf("REPORT_EDIT", "SYSTEM_ADMIN") }
        if (!canSeeAll) {
            val userId = userRepository.findByUsername(auth.name).map { it.id }.orElse(0L)
            if (!objectPermissionService.canAccess("REPORT", reportId, userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
            }
        }
        return ResponseEntity.ok(
            jobRunService.runJob(reportId, widgetId, request?.parameters ?: emptyMap(), auth.name)
        )
    }
}
