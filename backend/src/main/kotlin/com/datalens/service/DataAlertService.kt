package com.datalens.service

import com.datalens.model.*
import com.datalens.model.dto.*
import com.datalens.repository.*
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class DataAlertService(
    private val alertRepo: DataAlertRepository,
    private val eventRepo: AlertEventRepository,
    private val renderService: ReportRenderService,
    private val reportRepo: ReportRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Transactional
    fun create(request: AlertCreateRequest): AlertResponse {
        require(reportRepo.existsById(request.reportId)) {
            "Report not found: ${request.reportId}"
        }
        val alert = DataAlert(
            name = request.name,
            description = request.description,
            reportId = request.reportId,
            widgetId = request.widgetId,
            conditionType = request.conditionType,
            fieldName = request.fieldName,
            operator = request.operator,
            thresholdValue = request.thresholdValue,
            thresholdHigh = request.thresholdHigh,
            notificationType = request.notificationType,
            recipients = request.recipients,
            webhookUrl = request.webhookUrl,
            checkIntervalMin = request.checkIntervalMin
        )
        return toResponse(alertRepo.save(alert))
    }

    @Transactional
    fun update(id: Long, request: AlertUpdateRequest): AlertResponse {
        val alert = alertRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Alert not found: $id") }
        request.name?.let { alert.name = it }
        request.description?.let { alert.description = it }
        request.conditionType?.let { alert.conditionType = it }
        request.fieldName?.let { alert.fieldName = it }
        request.operator?.let { alert.operator = it }
        request.thresholdValue?.let { alert.thresholdValue = it }
        request.thresholdHigh?.let { alert.thresholdHigh = it }
        request.notificationType?.let { alert.notificationType = it }
        request.recipients?.let { alert.recipients = it }
        request.webhookUrl?.let { alert.webhookUrl = it }
        request.isActive?.let { alert.isActive = it }
        request.checkIntervalMin?.let { alert.checkIntervalMin = it }
        alert.updatedAt = Instant.now()
        return toResponse(alertRepo.save(alert))
    }

    fun getById(id: Long): AlertResponse {
        return toResponse(alertRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Alert not found: $id") })
    }

    fun listForReport(reportId: Long): List<AlertResponse> {
        return alertRepo.findByReportId(reportId).map { toResponse(it) }
    }

    fun listActive(): List<AlertResponse> {
        return alertRepo.findByIsActiveTrue().map { toResponse(it) }
    }

    @Transactional
    fun delete(id: Long) {
        require(alertRepo.existsById(id)) { "Alert not found: $id" }
        alertRepo.deleteById(id)
    }

    fun getEvents(alertId: Long, page: Int = 0, size: Int = 20): List<AlertEventResponse> {
        return eventRepo.findByAlertIdOrderByCreatedAtDesc(alertId, PageRequest.of(page, size))
            .content.map { toEventResponse(it) }
    }

    /**
     * Check a single alert against live data.
     */
    @Transactional
    fun checkAlert(alertId: Long): AlertCheckResult {
        val alert = alertRepo.findById(alertId)
            .orElseThrow { IllegalArgumentException("Alert not found: $alertId") }
        return evaluateAlert(alert)
    }

    /**
     * Check all due alerts (called by scheduler).
     */
    @Transactional
    fun checkDueAlerts(): List<AlertCheckResult> {
        val cutoff = Instant.now().minusSeconds(60) // At least 1 min since last check
        val dueAlerts = alertRepo.findDueAlerts(cutoff)
        log.info("Checking {} due alerts", dueAlerts.size)
        return dueAlerts.map { evaluateAlert(it) }
    }

    private fun evaluateAlert(alert: DataAlert): AlertCheckResult {
        return try {
            // Render the report to get current data
            val renderResult = renderService.renderReport(
                alert.reportId, RenderReportRequest(), "alert-system"
            )

            // Find the target widget or use first with data
            val widget = if (alert.widgetId != null) {
                renderResult.widgets.find { it.widgetId == alert.widgetId }
            } else {
                renderResult.widgets.firstOrNull { it.data != null }
            }

            if (widget?.data == null) {
                alert.lastCheckedAt = Instant.now()
                alertRepo.save(alert)
                return AlertCheckResult(alert.id, false, null, "No data available")
            }

            // Extract the field value
            val currentValue = extractFieldValue(widget.data!!, alert.fieldName, alert.conditionType)
            val triggered = evaluateCondition(alert, currentValue)

            // Update alert state
            alert.lastCheckedAt = Instant.now()
            alert.lastValue = currentValue

            if (triggered) {
                alert.consecutiveTriggers++
                alert.lastTriggeredAt = Instant.now()

                val event = AlertEvent(
                    alertId = alert.id,
                    eventType = "TRIGGERED",
                    fieldValue = currentValue,
                    thresholdValue = alert.thresholdValue,
                    message = buildMessage(alert, currentValue)
                )
                eventRepo.save(event)
                log.warn("Alert '{}' TRIGGERED: {} {} {}",
                    alert.name, currentValue, alert.operator, alert.thresholdValue)
            } else if (alert.consecutiveTriggers > 0) {
                // Was triggered, now resolved
                alert.consecutiveTriggers = 0
                val event = AlertEvent(
                    alertId = alert.id,
                    eventType = "RESOLVED",
                    fieldValue = currentValue,
                    thresholdValue = alert.thresholdValue,
                    message = "Alert resolved: ${alert.fieldName} = $currentValue"
                )
                eventRepo.save(event)
                log.info("Alert '{}' RESOLVED: {}", alert.name, currentValue)
            }

            alertRepo.save(alert)

            AlertCheckResult(
                alertId = alert.id,
                triggered = triggered,
                currentValue = currentValue,
                message = if (triggered) buildMessage(alert, currentValue) else "OK"
            )
        } catch (e: Exception) {
            log.error("Alert check failed for '{}': {}", alert.name, e.message)
            alert.lastCheckedAt = Instant.now()
            alertRepo.save(alert)

            val event = AlertEvent(
                alertId = alert.id,
                eventType = "ERROR",
                message = "Check failed: ${e.message}"
            )
            eventRepo.save(event)

            AlertCheckResult(alert.id, false, null, "Error: ${e.message}")
        }
    }

    private fun extractFieldValue(data: WidgetData, fieldName: String, conditionType: ConditionType): Double? {
        val colIdx = data.columns.indexOf(fieldName)

        return when (conditionType) {
            ConditionType.ROW_COUNT -> data.rowCount.toDouble()
            ConditionType.THRESHOLD, ConditionType.CHANGE_PERCENT -> {
                if (colIdx < 0) return null
                // Use first row value, or aggregate
                if (data.rows.isEmpty()) return null
                val firstRow = data.rows[0]
                when (val value = if (firstRow is Map<*, *>) firstRow[fieldName] else (firstRow as? List<*>)?.getOrNull(colIdx)) {
                    is Number -> value.toDouble()
                    is String -> value.toDoubleOrNull()
                    else -> null
                }
            }
            ConditionType.ANOMALY -> {
                // Simple: compute mean, compare last value
                if (colIdx < 0 || data.rows.isEmpty()) return null
                val values = data.rows.mapNotNull { row ->
                    when (val v = if (row is Map<*, *>) row[fieldName] else (row as? List<*>)?.getOrNull(colIdx)) {
                        is Number -> v.toDouble()
                        is String -> v.toDoubleOrNull()
                        else -> null
                    }
                }
                values.lastOrNull()
            }
        }
    }

    private fun evaluateCondition(alert: DataAlert, value: Double?): Boolean {
        if (value == null) return false
        val threshold = alert.thresholdValue ?: return false

        return when (alert.operator) {
            AlertOperator.GT -> value > threshold
            AlertOperator.GTE -> value >= threshold
            AlertOperator.LT -> value < threshold
            AlertOperator.LTE -> value <= threshold
            AlertOperator.EQ -> value == threshold
            AlertOperator.NEQ -> value != threshold
            AlertOperator.BETWEEN -> {
                val high = alert.thresholdHigh ?: return false
                value in threshold..high
            }
        }
    }

    private fun buildMessage(alert: DataAlert, value: Double?): String {
        return "Alert '${alert.name}': ${alert.fieldName} = $value (threshold: ${alert.operator} ${alert.thresholdValue})"
    }

    private fun toResponse(a: DataAlert) = AlertResponse(
        id = a.id, name = a.name, description = a.description,
        reportId = a.reportId, widgetId = a.widgetId,
        conditionType = a.conditionType, fieldName = a.fieldName,
        operator = a.operator, thresholdValue = a.thresholdValue,
        thresholdHigh = a.thresholdHigh, notificationType = a.notificationType,
        recipients = a.recipients, webhookUrl = a.webhookUrl,
        isActive = a.isActive, lastCheckedAt = a.lastCheckedAt,
        lastTriggeredAt = a.lastTriggeredAt, lastValue = a.lastValue,
        consecutiveTriggers = a.consecutiveTriggers,
        checkIntervalMin = a.checkIntervalMin,
        createdAt = a.createdAt, updatedAt = a.updatedAt
    )

    private fun toEventResponse(e: AlertEvent) = AlertEventResponse(
        id = e.id, alertId = e.alertId, eventType = e.eventType,
        fieldValue = e.fieldValue, thresholdValue = e.thresholdValue,
        message = e.message, notified = e.notified, createdAt = e.createdAt
    )
}
