package com.datorio.repository

import com.datorio.model.ChartAnnotation
import com.datorio.model.TooltipConfig
import com.datorio.model.WidgetContainer
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface ChartAnnotationRepository : JpaRepository<ChartAnnotation, Long> {
    fun findByWidgetIdOrderBySortOrder(widgetId: Long): List<ChartAnnotation>
    fun findByWidgetIdAndIsVisibleTrueOrderBySortOrder(widgetId: Long): List<ChartAnnotation>
    fun deleteByWidgetId(widgetId: Long)
}

@Repository
interface TooltipConfigRepository : JpaRepository<TooltipConfig, Long> {
    fun findByWidgetId(widgetId: Long): TooltipConfig?
    fun deleteByWidgetId(widgetId: Long)
}

@Repository
interface WidgetContainerRepository : JpaRepository<WidgetContainer, Long> {
    fun findByReportIdOrderBySortOrder(reportId: Long): List<WidgetContainer>
    fun deleteByReportId(reportId: Long)
}
