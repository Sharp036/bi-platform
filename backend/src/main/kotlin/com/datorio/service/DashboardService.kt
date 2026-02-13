package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class DashboardService(
    private val dashboardReportRepo: DashboardReportRepository,
    private val reportRepo: ReportRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Transactional
    fun addReportToDashboard(dashboardId: Long, request: DashboardReportRequest): DashboardReport {
        require(reportRepo.existsById(request.reportId)) {
            "Report not found: ${request.reportId}"
        }

        val dr = DashboardReport(
            dashboardId = dashboardId,
            reportId = request.reportId,
            position = request.position,
            sortOrder = request.sortOrder
        )
        val saved = dashboardReportRepo.save(dr)
        log.info("Added report {} to dashboard {}", request.reportId, dashboardId)
        return saved
    }

    @Transactional
    fun removeReportFromDashboard(dashboardId: Long, reportId: Long) {
        dashboardReportRepo.deleteByDashboardIdAndReportId(dashboardId, reportId)
        log.info("Removed report {} from dashboard {}", reportId, dashboardId)
    }

    fun getDashboardReports(dashboardId: Long): List<DashboardReportItem> {
        val links = dashboardReportRepo.findByDashboardIdOrderBySortOrder(dashboardId)
        return links.mapNotNull { link ->
            val report = reportRepo.findById(link.reportId).orElse(null)
            report?.let {
                DashboardReportItem(
                    dashboardReportId = link.id,
                    reportId = it.id,
                    reportName = it.name,
                    reportStatus = it.status,
                    position = link.position,
                    sortOrder = link.sortOrder
                )
            }
        }
    }
}
