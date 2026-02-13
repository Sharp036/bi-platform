package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class ReportScheduleService(
    private val scheduleRepo: ReportScheduleRepository,
    private val reportRepo: ReportRepository,
    private val renderService: ReportRenderService,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Transactional
    fun createSchedule(request: CreateScheduleRequest, username: String): ScheduleResponse {
        require(reportRepo.existsById(request.reportId)) {
            "Report not found: ${request.reportId}"
        }
        validateCron(request.cronExpression)

        val schedule = ReportSchedule(
            reportId = request.reportId,
            cronExpression = request.cronExpression,
            parameters = request.parameters,
            outputFormat = request.outputFormat,
            recipients = request.recipients,
            createdBy = null
        )
        val saved = scheduleRepo.save(schedule)
        log.info("Created schedule id={} for report {}, cron='{}'",
            saved.id, saved.reportId, saved.cronExpression)
        return toResponse(saved)
    }

    fun getSchedule(id: Long): ScheduleResponse {
        val schedule = scheduleRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Schedule not found: $id") }
        return toResponse(schedule)
    }

    fun listSchedulesForReport(reportId: Long): List<ScheduleResponse> {
        return scheduleRepo.findByReportId(reportId).map { toResponse(it) }
    }

    fun listActiveSchedules(): List<ScheduleResponse> {
        return scheduleRepo.findActiveSchedules().map { toResponse(it) }
    }

    @Transactional
    fun updateSchedule(id: Long, request: UpdateScheduleRequest): ScheduleResponse {
        val schedule = scheduleRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Schedule not found: $id") }

        request.cronExpression?.let {
            validateCron(it)
            schedule.cronExpression = it
        }
        request.isActive?.let { schedule.isActive = it }
        request.parameters?.let { schedule.parameters = it }
        request.outputFormat?.let { schedule.outputFormat = it }
        request.recipients?.let { schedule.recipients = it }
        schedule.updatedAt = Instant.now()

        val saved = scheduleRepo.save(schedule)
        log.info("Updated schedule id={}", saved.id)
        return toResponse(saved)
    }

    @Transactional
    fun toggleSchedule(id: Long): ScheduleResponse {
        val schedule = scheduleRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Schedule not found: $id") }
        schedule.isActive = !schedule.isActive
        schedule.updatedAt = Instant.now()
        val saved = scheduleRepo.save(schedule)
        log.info("Schedule id={} is now {}", saved.id, if (saved.isActive) "ACTIVE" else "PAUSED")
        return toResponse(saved)
    }

    @Transactional
    fun deleteSchedule(id: Long) {
        require(scheduleRepo.existsById(id)) { "Schedule not found: $id" }
        scheduleRepo.deleteById(id)
        log.info("Deleted schedule id={}", id)
    }

    /**
     * Execute a schedule immediately (manual trigger or cron trigger).
     * Renders the report, saves a snapshot, updates schedule status.
     */
    @Transactional
    fun executeSchedule(scheduleId: Long, username: String): ReportSnapshot {
        val schedule = scheduleRepo.findById(scheduleId)
            .orElseThrow { IllegalArgumentException("Schedule not found: $scheduleId") }

        val params: Map<String, Any?> = try {
            if (schedule.parameters == "{}") emptyMap()
            else objectMapper.readValue(schedule.parameters)
        } catch (e: Exception) {
            emptyMap()
        }

        val snapshot = renderService.renderAndSnapshot(
            reportId = schedule.reportId,
            params = params,
            username = username,
            scheduleId = schedule.id,
            outputFormat = schedule.outputFormat
        )

        // Update schedule last-run status
        schedule.lastRunAt = Instant.now()
        if (snapshot.status == "SUCCESS") {
            schedule.lastStatus = ScheduleStatus.SUCCESS
            schedule.lastError = null
        } else {
            schedule.lastStatus = ScheduleStatus.ERROR
            schedule.lastError = snapshot.errorMessage
        }
        schedule.updatedAt = Instant.now()
        scheduleRepo.save(schedule)

        log.info("Executed schedule id={} for report {}: status={}",
            scheduleId, schedule.reportId, snapshot.status)
        return snapshot
    }

    // ── Helpers ──

    private fun validateCron(expression: String) {
        val parts = expression.trim().split("\\s+".toRegex())
        require(parts.size in 5..6) {
            "Invalid cron expression '$expression': expected 5 or 6 fields (minute hour dayOfMonth month dayOfWeek [year])"
        }
    }

    private fun toResponse(s: ReportSchedule): ScheduleResponse {
        val reportName = try {
            reportRepo.findById(s.reportId).orElse(null)?.name
        } catch (_: Exception) { null }

        return ScheduleResponse(
            id = s.id, reportId = s.reportId, reportName = reportName,
            cronExpression = s.cronExpression, isActive = s.isActive,
            parameters = s.parameters, outputFormat = s.outputFormat,
            recipients = s.recipients, lastRunAt = s.lastRunAt,
            lastStatus = s.lastStatus, lastError = s.lastError,
            createdBy = s.createdBy, createdAt = s.createdAt, updatedAt = s.updatedAt
        )
    }
}
