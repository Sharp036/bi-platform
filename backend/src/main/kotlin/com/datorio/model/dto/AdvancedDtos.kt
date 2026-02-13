package com.datorio.model.dto

import com.datorio.model.*
import java.time.Instant

// ═══════════════════════════════════════════════
//  Calculated Field DTOs
// ═══════════════════════════════════════════════

data class CalcFieldCreateRequest(
    val reportId: Long,
    val name: String,
    val label: String? = null,
    val expression: String,
    val resultType: ResultType = ResultType.NUMBER,
    val formatPattern: String? = null,
    val sortOrder: Int = 0
)

data class CalcFieldUpdateRequest(
    val name: String? = null,
    val label: String? = null,
    val expression: String? = null,
    val resultType: ResultType? = null,
    val formatPattern: String? = null,
    val isActive: Boolean? = null,
    val sortOrder: Int? = null
)

data class CalcFieldResponse(
    val id: Long,
    val reportId: Long,
    val name: String,
    val label: String?,
    val expression: String,
    val resultType: ResultType,
    val formatPattern: String?,
    val sortOrder: Int,
    val isActive: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant
)

// ═══════════════════════════════════════════════
//  Data Alert DTOs
// ═══════════════════════════════════════════════

data class AlertCreateRequest(
    val name: String,
    val description: String? = null,
    val reportId: Long,
    val widgetId: Long? = null,
    val conditionType: ConditionType = ConditionType.THRESHOLD,
    val fieldName: String,
    val operator: AlertOperator = AlertOperator.GT,
    val thresholdValue: Double? = null,
    val thresholdHigh: Double? = null,
    val notificationType: NotificationType = NotificationType.IN_APP,
    val recipients: String? = null,
    val webhookUrl: String? = null,
    val checkIntervalMin: Int = 60
)

data class AlertUpdateRequest(
    val name: String? = null,
    val description: String? = null,
    val conditionType: ConditionType? = null,
    val fieldName: String? = null,
    val operator: AlertOperator? = null,
    val thresholdValue: Double? = null,
    val thresholdHigh: Double? = null,
    val notificationType: NotificationType? = null,
    val recipients: String? = null,
    val webhookUrl: String? = null,
    val isActive: Boolean? = null,
    val checkIntervalMin: Int? = null
)

data class AlertResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val reportId: Long,
    val widgetId: Long?,
    val conditionType: ConditionType,
    val fieldName: String,
    val operator: AlertOperator,
    val thresholdValue: Double?,
    val thresholdHigh: Double?,
    val notificationType: NotificationType,
    val recipients: String?,
    val webhookUrl: String?,
    val isActive: Boolean,
    val lastCheckedAt: Instant?,
    val lastTriggeredAt: Instant?,
    val lastValue: Double?,
    val consecutiveTriggers: Int,
    val checkIntervalMin: Int,
    val createdAt: Instant,
    val updatedAt: Instant
)

data class AlertEventResponse(
    val id: Long,
    val alertId: Long,
    val eventType: String,
    val fieldValue: Double?,
    val thresholdValue: Double?,
    val message: String?,
    val notified: Boolean,
    val createdAt: Instant
)

data class AlertCheckResult(
    val alertId: Long,
    val triggered: Boolean,
    val currentValue: Double?,
    val message: String
)

// ═══════════════════════════════════════════════
//  Bookmark DTOs
// ═══════════════════════════════════════════════

data class BookmarkCreateRequest(
    val reportId: Long,
    val name: String,
    val description: String? = null,
    val parameters: Map<String, Any?> = emptyMap(),
    val filters: Map<String, Any?> = emptyMap(),
    val isDefault: Boolean = false,
    val isShared: Boolean = false
)

data class BookmarkUpdateRequest(
    val name: String? = null,
    val description: String? = null,
    val parameters: Map<String, Any?>? = null,
    val filters: Map<String, Any?>? = null,
    val isDefault: Boolean? = null,
    val isShared: Boolean? = null
)

data class BookmarkResponse(
    val id: Long,
    val reportId: Long,
    val name: String,
    val description: String?,
    val parameters: Map<String, Any?>,
    val filters: Map<String, Any?>,
    val isDefault: Boolean,
    val isShared: Boolean,
    val createdBy: Long?,
    val createdAt: Instant,
    val updatedAt: Instant
)
