package com.datalens.scheduling

import com.datalens.service.ReportScheduleService
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.scheduling.support.CronExpression
import org.springframework.stereotype.Component
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

/**
 * Background scheduler that checks active report schedules every minute
 * and executes them when their cron expression matches.
 *
 * This is a simple polling-based approach. For production at scale,
 * consider Quartz Scheduler or a dedicated job queue.
 */
@Component
class ReportScheduler(
    private val scheduleService: ReportScheduleService
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // System username used for scheduled executions
    private val systemUsername = "system"

    /**
     * Runs every minute. For each active schedule, checks if the
     * cron expression indicates it should run now (within the current minute).
     */
    @Scheduled(fixedRate = 60_000, initialDelay = 30_000)
    fun checkSchedules() {
        try {
            val schedules = scheduleService.listActiveSchedules()
            if (schedules.isEmpty()) return

            val now = LocalDateTime.now(ZoneOffset.UTC)

            for (schedule in schedules) {
                try {
                    if (shouldRun(schedule.cronExpression, schedule.lastRunAt, now)) {
                        log.info("Triggering scheduled execution for schedule id={}, report={}",
                            schedule.id, schedule.reportId)
                        scheduleService.executeSchedule(schedule.id, systemUsername)
                    }
                } catch (e: Exception) {
                    log.error("Error executing schedule id={}: {}", schedule.id, e.message)
                }
            }
        } catch (e: Exception) {
            log.error("Error in schedule check loop: {}", e.message)
        }
    }

    /**
     * Determines if a schedule should run now based on its cron expression.
     * Uses Spring's CronExpression to find the next execution time
     * from the last run (or epoch if never run).
     */
    private fun shouldRun(cronExpression: String, lastRunAt: Instant?, now: LocalDateTime): Boolean {
        return try {
            val cron = CronExpression.parse(cronExpression)
            val lastRun = lastRunAt
                ?.let { LocalDateTime.ofInstant(it, ZoneOffset.UTC) }
                ?: now.minusDays(1)

            val nextRun = cron.next(lastRun) ?: return false

            // Should run if next scheduled time is at or before now,
            // but not more than 2 minutes in the past (avoid catch-up storms)
            !nextRun.isAfter(now) &&
                ChronoUnit.MINUTES.between(nextRun, now) < 2
        } catch (e: Exception) {
            log.warn("Invalid cron expression '{}': {}", cronExpression, e.message)
            false
        }
    }
}
