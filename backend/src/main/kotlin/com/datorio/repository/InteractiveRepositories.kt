package com.datorio.repository

import com.datorio.model.*
import org.springframework.data.jpa.repository.JpaRepository

interface ChartLayerRepository : JpaRepository<ChartLayer, Long> {
    fun findByWidgetIdOrderBySortOrder(widgetId: Long): List<ChartLayer>
    fun deleteByWidgetId(widgetId: Long)
}

interface DashboardActionRepository : JpaRepository<DashboardAction, Long> {
    fun findByReportIdAndIsActiveTrueOrderBySortOrder(reportId: Long): List<DashboardAction>
    fun findByReportIdOrderBySortOrder(reportId: Long): List<DashboardAction>
    fun findBySourceWidgetId(sourceWidgetId: Long): List<DashboardAction>
}

interface VisibilityRuleRepository : JpaRepository<VisibilityRule, Long> {
    fun findByWidgetIdAndIsActiveTrue(widgetId: Long): List<VisibilityRule>
    fun findByWidgetId(widgetId: Long): List<VisibilityRule>
    fun deleteByWidgetId(widgetId: Long)
}

interface DashboardOverlayRepository : JpaRepository<DashboardOverlay, Long> {
    fun findByReportIdAndIsVisibleTrueOrderByZIndex(reportId: Long): List<DashboardOverlay>
    fun findByReportIdOrderByZIndex(reportId: Long): List<DashboardOverlay>
    fun deleteByReportId(reportId: Long)
}
