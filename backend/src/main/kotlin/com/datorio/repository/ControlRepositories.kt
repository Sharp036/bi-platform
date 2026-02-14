package com.datorio.repository

import com.datorio.model.GlobalFilterConfig
import com.datorio.model.ParameterControl
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface GlobalFilterConfigRepository : JpaRepository<GlobalFilterConfig, Long> {
    fun findByReportId(reportId: Long): List<GlobalFilterConfig>
    fun findByReportIdAndWidgetId(reportId: Long, widgetId: Long): GlobalFilterConfig?
    fun findByReportIdAndIsFilterSourceTrue(reportId: Long): List<GlobalFilterConfig>
    fun findByReportIdAndIsEnabledTrue(reportId: Long): List<GlobalFilterConfig>
    fun deleteByReportIdAndWidgetId(reportId: Long, widgetId: Long)
}

@Repository
interface ParameterControlRepository : JpaRepository<ParameterControl, Long> {
    fun findByReportIdOrderBySortOrder(reportId: Long): List<ParameterControl>
    fun findByReportIdAndParameterName(reportId: Long, parameterName: String): ParameterControl?
    fun deleteByReportIdAndParameterName(reportId: Long, parameterName: String)
}
