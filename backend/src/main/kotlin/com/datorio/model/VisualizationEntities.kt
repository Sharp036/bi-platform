package com.datorio.model

import jakarta.persistence.*
import org.hibernate.annotations.ColumnTransformer
import java.time.OffsetDateTime

@Entity
@Table(name = "dl_chart_annotation")
class ChartAnnotation(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "widget_id", nullable = false)
    val widgetId: Long,

    @Column(name = "annotation_type", nullable = false, length = 30)
    var annotationType: String = "LINE",

    @Column(nullable = false, length = 10)
    var axis: String = "y",

    @Column
    var value: Double? = null,

    @Column(name = "value_end")
    var valueEnd: Double? = null,

    @Column(length = 300)
    var label: String? = null,

    @Column(length = 30)
    var color: String? = "#ef4444",

    @Column(name = "line_style", length = 20)
    var lineStyle: String? = "solid",

    @Column(name = "line_width")
    var lineWidth: Double? = 1.5,

    @Column
    var opacity: Double? = 0.8,

    @Column(name = "fill_color", length = 30)
    var fillColor: String? = null,

    @Column(name = "fill_opacity")
    var fillOpacity: Double? = 0.1,

    @Column(length = 20)
    var position: String? = "end",

    @Column(name = "font_size")
    var fontSize: Int? = 12,

    @Column(name = "is_visible", nullable = false)
    var isVisible: Boolean = true,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    var config: String = "{}",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

@Entity
@Table(name = "dl_tooltip_config")
class TooltipConfig(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "widget_id", nullable = false, unique = true)
    val widgetId: Long,

    @Column(name = "is_enabled", nullable = false)
    var isEnabled: Boolean = true,

    @Column(name = "show_title", nullable = false)
    var showTitle: Boolean = true,

    @Column(name = "title_field", length = 200)
    var titleField: String? = null,

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    var fields: String = "[]",

    @Column(name = "show_sparkline", nullable = false)
    var showSparkline: Boolean = false,

    @Column(name = "sparkline_field", length = 200)
    var sparklineField: String? = null,

    @Column(name = "html_template", length = 2000)
    var htmlTemplate: String? = null,

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    var config: String = "{}",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

@Entity
@Table(name = "dl_widget_container")
class WidgetContainer(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    val reportId: Long,

    @Column(name = "container_type", nullable = false, length = 30)
    var containerType: String = "TABS",

    @Column(length = 300)
    var name: String? = null,

    @Column(name = "child_widget_ids", nullable = false)
    var childWidgetIds: String,

    @Column(name = "active_tab", nullable = false)
    var activeTab: Int = 0,

    @Column(name = "auto_distribute", nullable = false)
    var autoDistribute: Boolean = true,

    @Column(columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    var config: String = "{}",

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)
