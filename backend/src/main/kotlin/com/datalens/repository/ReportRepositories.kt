package com.datalens.repository

import com.datalens.model.*
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface ReportRepository : JpaRepository<Report, Long> {

    fun findByStatus(status: ReportStatus, pageable: Pageable): Page<Report>

    fun findByCreatedBy(userId: Long, pageable: Pageable): Page<Report>

    fun findByIsTemplateTrue(pageable: Pageable): Page<Report>

    @Query("SELECT r FROM Report r WHERE r.folderId = :folderId ORDER BY r.name")
    fun findByFolderId(folderId: Long, pageable: Pageable): Page<Report>

    @Query("SELECT r FROM Report r WHERE LOWER(r.name) LIKE LOWER(CONCAT('%', :term, '%'))")
    fun searchByName(term: String, pageable: Pageable): Page<Report>

    @Query("""
        SELECT r FROM Report r 
        WHERE (:status IS NULL OR r.status = :status) 
        AND (:createdBy IS NULL OR r.createdBy = :createdBy)
        AND (:folderId IS NULL OR r.folderId = :folderId)
        ORDER BY r.updatedAt DESC
    """)
    fun findFiltered(
        status: ReportStatus?,
        createdBy: Long?,
        folderId: Long?,
        pageable: Pageable
    ): Page<Report>
}

@Repository
interface ReportParameterRepository : JpaRepository<ReportParameter, Long> {

    fun findByReportIdOrderBySortOrder(reportId: Long): List<ReportParameter>

    fun deleteByReportId(reportId: Long)
}

@Repository
interface ReportWidgetRepository : JpaRepository<ReportWidget, Long> {

    fun findByReportIdOrderBySortOrder(reportId: Long): List<ReportWidget>

    fun findByQueryId(queryId: Long): List<ReportWidget>

    fun deleteByReportId(reportId: Long)
}

@Repository
interface DashboardReportRepository : JpaRepository<DashboardReport, Long> {

    fun findByDashboardIdOrderBySortOrder(dashboardId: Long): List<DashboardReport>

    fun findByReportId(reportId: Long): List<DashboardReport>

    fun deleteByDashboardIdAndReportId(dashboardId: Long, reportId: Long)
}

@Repository
interface ReportScheduleRepository : JpaRepository<ReportSchedule, Long> {

    fun findByReportId(reportId: Long): List<ReportSchedule>

    fun findByIsActiveTrue(): List<ReportSchedule>

    @Query("SELECT s FROM ReportSchedule s WHERE s.isActive = true ORDER BY s.updatedAt ASC")
    fun findActiveSchedules(): List<ReportSchedule>
}

@Repository
interface ReportSnapshotRepository : JpaRepository<ReportSnapshot, Long> {

    fun findByReportIdOrderByCreatedAtDesc(reportId: Long, pageable: Pageable): Page<ReportSnapshot>

    fun findByScheduleIdOrderByCreatedAtDesc(scheduleId: Long, pageable: Pageable): Page<ReportSnapshot>

    @Query("SELECT s FROM ReportSnapshot s WHERE s.reportId = :reportId ORDER BY s.createdAt DESC")
    fun findLatestByReportId(reportId: Long, pageable: Pageable): Page<ReportSnapshot>
}
