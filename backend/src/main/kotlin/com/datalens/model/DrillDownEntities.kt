package com.datalens.model

import jakarta.persistence.*
import java.time.Instant

// ─────────────────────────────────────────────
//  Drill-Down Types
// ─────────────────────────────────────────────

enum class DrillActionType { DRILL_DOWN, DRILL_THROUGH, CROSS_LINK }
enum class TriggerType { ROW_CLICK, CHART_CLICK, BUTTON }
enum class OpenMode { REPLACE, NEW_TAB }

// ─────────────────────────────────────────────
//  Drill-Down Action
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_drill_action")
class DrillAction(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "source_widget_id", nullable = false)
    var sourceWidgetId: Long,

    @Column(name = "target_report_id", nullable = false)
    var targetReportId: Long,

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 30)
    var actionType: DrillActionType = DrillActionType.DRILL_DOWN,

    @Column(length = 300)
    var label: String? = null,

    var description: String? = null,

    @Column(name = "param_mapping", nullable = false, columnDefinition = "jsonb")
    var paramMapping: String = "{}",

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type", nullable = false, length = 30)
    var triggerType: TriggerType = TriggerType.ROW_CLICK,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Enumerated(EnumType.STRING)
    @Column(name = "open_mode", nullable = false, length = 20)
    var openMode: OpenMode = OpenMode.REPLACE,

    @Column(columnDefinition = "jsonb")
    var config: String = "{}",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)
