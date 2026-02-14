package com.datorio.model

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "dl_global_filter_config")
class GlobalFilterConfig(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    val reportId: Long,

    @Column(name = "widget_id", nullable = false)
    val widgetId: Long,

    @Column(name = "is_filter_source", nullable = false)
    var isFilterSource: Boolean = false,

    @Column(name = "filter_field", length = 200)
    var filterField: String? = null,

    @Column(name = "excluded_targets")
    var excludedTargets: String? = null,

    @Column(name = "is_enabled", nullable = false)
    var isEnabled: Boolean = true,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

@Entity
@Table(name = "dl_parameter_control")
class ParameterControl(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    val reportId: Long,

    @Column(name = "parameter_name", nullable = false, length = 100)
    var parameterName: String,

    @Column(name = "control_type", nullable = false, length = 30)
    var controlType: String = "INPUT",

    @Column(name = "datasource_id")
    var datasourceId: Long? = null,

    @Column(name = "options_query")
    var optionsQuery: String? = null,

    @Column(name = "cascade_parent", length = 100)
    var cascadeParent: String? = null,

    @Column(name = "cascade_field", length = 200)
    var cascadeField: String? = null,

    @Column(name = "slider_min")
    var sliderMin: Double? = null,

    @Column(name = "slider_max")
    var sliderMax: Double? = null,

    @Column(name = "slider_step")
    var sliderStep: Double? = 1.0,

    @Column(columnDefinition = "jsonb")
    var config: String = "{}",

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)
