package com.datalens.repository

import com.datalens.model.DrillAction
import org.springframework.data.jpa.repository.JpaRepository

interface DrillActionRepository : JpaRepository<DrillAction, Long> {

    fun findBySourceWidgetIdAndIsActiveTrueOrderBySortOrder(sourceWidgetId: Long): List<DrillAction>

    fun findByTargetReportId(targetReportId: Long): List<DrillAction>

    fun findBySourceWidgetIdIn(widgetIds: List<Long>): List<DrillAction>
}
