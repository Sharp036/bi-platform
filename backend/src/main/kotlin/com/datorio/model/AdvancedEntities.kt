package com.datorio.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

// ─────────────────────────────────────────────
//  Calculated Field
// ─────────────────────────────────────────────

enum class ResultType { NUMBER, STRING, DATE, BOOLEAN }

@Entity
@Table(name = "dl_calculated_field")
class CalculatedField(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    var reportId: Long,

    @Column(nullable = false, length = 200)
    var name: String,

    @Column(length = 300)
    var label: String? = null,

    @Column(nullable = false, columnDefinition = "text")
    var expression: String,

    @Enumerated(EnumType.STRING)
    @Column(name = "result_type", nullable = false, length = 30)
    var resultType: ResultType = ResultType.NUMBER,

    @Column(name = "format_pattern", length = 100)
    var formatPattern: String? = null,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)

// ─────────────────────────────────────────────
//  Data Alert
// ─────────────────────────────────────────────

enum class ConditionType { THRESHOLD, CHANGE_PERCENT, ANOMALY, ROW_COUNT }
enum class AlertOperator { GT, GTE, LT, LTE, EQ, NEQ, BETWEEN }
enum class NotificationType { IN_APP, EMAIL, WEBHOOK }

@Entity
@Table(name = "dl_data_alert")
class DataAlert(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 300)
    var name: String,

    var description: String? = null,

    @Column(name = "report_id", nullable = false)
    var reportId: Long,

    @Column(name = "widget_id")
    var widgetId: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "condition_type", nullable = false, length = 30)
    var conditionType: ConditionType = ConditionType.THRESHOLD,

    @Column(name = "field_name", nullable = false, length = 200)
    var fieldName: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var operator: AlertOperator = AlertOperator.GT,

    @Column(name = "threshold_value")
    var thresholdValue: Double? = null,

    @Column(name = "threshold_high")
    var thresholdHigh: Double? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 30)
    var notificationType: NotificationType = NotificationType.IN_APP,

    var recipients: String? = null,

    @Column(name = "webhook_url", length = 500)
    var webhookUrl: String? = null,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(name = "last_checked_at")
    var lastCheckedAt: Instant? = null,

    @Column(name = "last_triggered_at")
    var lastTriggeredAt: Instant? = null,

    @Column(name = "last_value")
    var lastValue: Double? = null,

    @Column(name = "consecutive_triggers", nullable = false)
    var consecutiveTriggers: Int = 0,

    @Column(name = "check_interval_min", nullable = false)
    var checkIntervalMin: Int = 60,

    @Column(name = "created_by")
    var createdBy: Long? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)

// ─────────────────────────────────────────────
//  Alert Event
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_alert_event")
class AlertEvent(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "alert_id", nullable = false)
    var alertId: Long,

    @Column(name = "event_type", nullable = false, length = 30)
    var eventType: String,

    @Column(name = "field_value")
    var fieldValue: Double? = null,

    @Column(name = "threshold_value")
    var thresholdValue: Double? = null,

    var message: String? = null,

    @Column(nullable = false)
    var notified: Boolean = false,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)

// ─────────────────────────────────────────────
//  Bookmark
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_bookmark")
class Bookmark(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    var reportId: Long,

    @Column(nullable = false, length = 300)
    var name: String,

    var description: String? = null,

    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var parameters: String = "{}",

    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var filters: String = "{}",

    @Column(name = "is_default", nullable = false)
    var isDefault: Boolean = false,

    @Column(name = "is_shared", nullable = false)
    var isShared: Boolean = false,

    @Column(name = "created_by")
    var createdBy: Long? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)
