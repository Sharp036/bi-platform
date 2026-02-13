package com.datorio.repository

import com.datorio.model.*
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface CalculatedFieldRepository : JpaRepository<CalculatedField, Long> {
    fun findByReportIdAndIsActiveTrueOrderBySortOrder(reportId: Long): List<CalculatedField>
    fun findByReportIdOrderBySortOrder(reportId: Long): List<CalculatedField>
}

interface DataAlertRepository : JpaRepository<DataAlert, Long> {
    fun findByReportId(reportId: Long): List<DataAlert>
    fun findByIsActiveTrue(): List<DataAlert>

    @Query("SELECT a FROM DataAlert a WHERE a.isActive = true AND (a.lastCheckedAt IS NULL OR a.lastCheckedAt < :before)")
    fun findDueAlerts(before: java.time.Instant): List<DataAlert>
}

interface AlertEventRepository : JpaRepository<AlertEvent, Long> {
    fun findByAlertIdOrderByCreatedAtDesc(alertId: Long, pageable: Pageable): Page<AlertEvent>
    fun countByAlertIdAndEventType(alertId: Long, eventType: String): Long
}

interface BookmarkRepository : JpaRepository<Bookmark, Long> {
    fun findByReportIdOrderByCreatedAtDesc(reportId: Long): List<Bookmark>
    fun findByReportIdAndIsDefaultTrue(reportId: Long): Bookmark?
    fun findByReportIdAndCreatedBy(reportId: Long, createdBy: Long): List<Bookmark>

    @Query("SELECT b FROM Bookmark b WHERE b.reportId = :reportId AND (b.isShared = true OR b.createdBy = :userId) ORDER BY b.isDefault DESC, b.name")
    fun findAccessibleBookmarks(reportId: Long, userId: Long): List<Bookmark>
}
