package com.datorio.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

// ─────────────────────────────────────────────
//  Chart Layer
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_chart_layer")
class ChartLayer(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "widget_id", nullable = false)
    var widgetId: Long,

    @Column(nullable = false, length = 200)
    var name: String,

    @Column(length = 300)
    var label: String? = null,

    @Column(name = "query_id")
    var queryId: Long? = null,

    @Column(name = "datasource_id")
    var datasourceId: Long? = null,

    @Column(name = "raw_sql")
    var rawSql: String? = null,

    @Column(name = "chart_type", nullable = false, length = 30)
    var chartType: String = "line",

    @Column(nullable = false, length = 10)
    var axis: String = "left",

    @Column(length = 30)
    var color: String? = null,

    @Column
    var opacity: Double = 1.0,

    @Column(name = "is_visible", nullable = false)
    var isVisible: Boolean = true,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "series_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var seriesConfig: String = "{}",

    @Column(name = "category_field", length = 200)
    var categoryField: String? = null,

    @Column(name = "value_field", length = 200)
    var valueField: String? = null,

    @Column(name = "param_mapping", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var paramMapping: String = "{}",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)

// ─────────────────────────────────────────────
//  Dashboard Action
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_dashboard_action")
class DashboardAction(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    var reportId: Long,

    @Column(nullable = false, length = 300)
    var name: String,

    @Column(name = "action_type", nullable = false, length = 30)
    var actionType: String = "FILTER",

    @Column(name = "trigger_type", nullable = false, length = 20)
    var triggerType: String = "CLICK",

    @Column(name = "source_widget_id")
    var sourceWidgetId: Long? = null,

    @Column(name = "target_widget_ids")
    var targetWidgetIds: String? = null,

    @Column(name = "source_field", length = 200)
    var sourceField: String? = null,

    @Column(name = "target_field", length = 200)
    var targetField: String? = null,

    @Column(name = "target_report_id")
    var targetReportId: Long? = null,

    @Column(name = "url_template", length = 1000)
    var urlTemplate: String? = null,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var config: String = "{}",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)

// ─────────────────────────────────────────────
//  Visibility Rule
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_visibility_rule")
class VisibilityRule(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "widget_id", nullable = false)
    var widgetId: Long,

    @Column(name = "rule_type", nullable = false, length = 30)
    var ruleType: String = "PARAMETER",

    @Column(name = "parameter_name", length = 200)
    var parameterName: String? = null,

    @Column(nullable = false, length = 20)
    var operator: String = "EQ",

    @Column(name = "expected_value", length = 500)
    var expectedValue: String? = null,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)

// ─────────────────────────────────────────────
//  Dashboard Overlay (logos, floating elements)
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_dashboard_overlay")
class DashboardOverlay(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    var reportId: Long,

    @Column(name = "overlay_type", nullable = false, length = 30)
    var overlayType: String = "IMAGE",

    var content: String? = null,

    @Column(name = "position_x", nullable = false)
    var positionX: Int = 0,

    @Column(name = "position_y", nullable = false)
    var positionY: Int = 0,

    @Column(nullable = false)
    var width: Int = 100,

    @Column(nullable = false)
    var height: Int = 50,

    @Column
    var opacity: Double = 1.0,

    @Column(name = "z_index", nullable = false)
    var zIndex: Int = 100,

    @Column(name = "link_url", length = 1000)
    var linkUrl: String? = null,

    @Column(name = "is_visible", nullable = false)
    var isVisible: Boolean = true,

    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var style: String = "{}",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)
