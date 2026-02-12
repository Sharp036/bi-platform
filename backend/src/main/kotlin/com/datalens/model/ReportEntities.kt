package com.datalens.model

import jakarta.persistence.*
import java.time.Instant

// ─────────────────────────────────────────────
//  Report
// ─────────────────────────────────────────────

enum class ReportType { STANDARD, TEMPLATE, SCHEDULED }
enum class ReportStatus { DRAFT, PUBLISHED, ARCHIVED }
enum class WidgetType { CHART, TABLE, KPI, TEXT, FILTER, IMAGE }
enum class ParamType { STRING, NUMBER, DATE, DATE_RANGE, SELECT, MULTI_SELECT, BOOLEAN }
enum class OutputFormat { JSON, PDF, CSV, EXCEL }
enum class ScheduleStatus { SUCCESS, ERROR }

@Entity
@Table(name = "dl_report")
class Report(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 300)
    var name: String,

    var description: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "report_type", nullable = false, length = 30)
    var reportType: ReportType = ReportType.STANDARD,

    @Column(columnDefinition = "jsonb")
    var layout: String = "{}",

    @Column(columnDefinition = "jsonb")
    var settings: String = "{}",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: ReportStatus = ReportStatus.DRAFT,

    @Column(name = "is_template")
    var isTemplate: Boolean = false,

    @Column(name = "thumbnail_url", length = 500)
    var thumbnailUrl: String? = null,

    @Column(name = "folder_id")
    var folderId: Long? = null,

    @Column(name = "created_by")
    var createdBy: Long? = null,

    @Column(name = "updated_by")
    var updatedBy: Long? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),

    @OneToMany(mappedBy = "report", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    val parameters: MutableList<ReportParameter> = mutableListOf(),

    @OneToMany(mappedBy = "report", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    val widgets: MutableList<ReportWidget> = mutableListOf()
)

// ─────────────────────────────────────────────
//  Report Parameter
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_report_parameter", uniqueConstraints = [UniqueConstraint(columnNames = ["report_id", "name"])])
class ReportParameter(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "report_id", nullable = false)
    var report: Report? = null,

    @Column(nullable = false, length = 100)
    var name: String,

    @Column(length = 200)
    var label: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "param_type", nullable = false, length = 30)
    var paramType: ParamType,

    @Column(name = "default_value", length = 500)
    var defaultValue: String? = null,

    @Column(name = "is_required", nullable = false)
    var isRequired: Boolean = true,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(columnDefinition = "jsonb")
    var config: String = "{}"
)

// ─────────────────────────────────────────────
//  Report Widget
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_report_widget")
class ReportWidget(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "report_id", nullable = false)
    var report: Report? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "widget_type", nullable = false, length = 30)
    var widgetType: WidgetType,

    @Column(length = 300)
    var title: String? = null,

    @Column(name = "query_id")
    var queryId: Long? = null,

    @Column(name = "datasource_id")
    var datasourceId: Long? = null,

    @Column(name = "raw_sql")
    var rawSql: String? = null,

    @Column(name = "chart_config", columnDefinition = "jsonb")
    var chartConfig: String = "{}",

    @Column(columnDefinition = "jsonb")
    var position: String = "{}",

    @Column(columnDefinition = "jsonb")
    var style: String = "{}",

    @Column(name = "param_mapping", columnDefinition = "jsonb")
    var paramMapping: String = "{}",

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "is_visible", nullable = false)
    var isVisible: Boolean = true,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)

// ─────────────────────────────────────────────
//  Dashboard ↔ Report junction
// ─────────────────────────────────────────────

@Entity
@Table(
    name = "dl_dashboard_report",
    uniqueConstraints = [UniqueConstraint(columnNames = ["dashboard_id", "report_id"])]
)
class DashboardReport(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "dashboard_id", nullable = false)
    var dashboardId: Long,

    @Column(name = "report_id", nullable = false)
    var reportId: Long,

    @Column(columnDefinition = "jsonb")
    var position: String = "{}",

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0
)

// ─────────────────────────────────────────────
//  Report Schedule
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_report_schedule")
class ReportSchedule(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    var reportId: Long,

    @Column(name = "cron_expression", nullable = false, length = 100)
    var cronExpression: String,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(columnDefinition = "jsonb")
    var parameters: String = "{}",

    @Enumerated(EnumType.STRING)
    @Column(name = "output_format", nullable = false, length = 20)
    var outputFormat: OutputFormat = OutputFormat.JSON,

    @Column(columnDefinition = "jsonb")
    var recipients: String = "[]",

    @Column(name = "last_run_at")
    var lastRunAt: Instant? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "last_status", length = 20)
    var lastStatus: ScheduleStatus? = null,

    @Column(name = "last_error")
    var lastError: String? = null,

    @Column(name = "created_by")
    var createdBy: Long? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)

// ─────────────────────────────────────────────
//  Report Snapshot
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_report_snapshot")
class ReportSnapshot(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    var reportId: Long,

    @Column(name = "schedule_id")
    var scheduleId: Long? = null,

    @Column(columnDefinition = "jsonb")
    var parameters: String = "{}",

    @Column(name = "result_data", columnDefinition = "jsonb")
    var resultData: String = "{}",

    @Enumerated(EnumType.STRING)
    @Column(name = "output_format", nullable = false, length = 20)
    var outputFormat: OutputFormat = OutputFormat.JSON,

    @Column(name = "file_path", length = 500)
    var filePath: String? = null,

    @Column(nullable = false, length = 20)
    var status: String = "SUCCESS",

    @Column(name = "execution_ms")
    var executionMs: Long? = null,

    @Column(name = "error_message")
    var errorMessage: String? = null,

    @Column(name = "created_by")
    var createdBy: Long? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)
