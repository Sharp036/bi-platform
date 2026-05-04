package com.datorio.repository

import com.datorio.model.ImportLog
import com.datorio.model.ImportLogError
import com.datorio.model.ImportSource
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface ImportSourceRepository : JpaRepository<ImportSource, Long> {

    @Query("""
        SELECT DISTINCT s FROM ImportSource s
        WHERE EXISTS (
            SELECT p FROM ObjectPermission p
            WHERE p.objectType = 'IMPORT_SOURCE' AND p.objectId = s.id
            AND (p.user.id = :userId OR p.role.id IN :roleIds)
        )
    """)
    fun findAccessibleSources(userId: Long, roleIds: Collection<Long>): List<ImportSource>
}

@Repository
interface ImportLogRepository : JpaRepository<ImportLog, Long> {

    @Query(
        value = """
            SELECT l FROM ImportLog l
            LEFT JOIN l.uploadedBy u
            JOIN l.source s
            WHERE (:username   = '' OR u.username = :username)
              AND (:sourceName = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :sourceName, '%')))
              AND (:filename   = '' OR LOWER(l.filename) LIKE LOWER(CONCAT('%', :filename, '%')))
              AND (:userFilter = '' OR LOWER(u.username) LIKE LOWER(CONCAT('%', :userFilter, '%')))
              AND (:status     = '' OR l.status = :status)
        """,
        countQuery = """
            SELECT COUNT(l) FROM ImportLog l
            LEFT JOIN l.uploadedBy u
            JOIN l.source s
            WHERE (:username   = '' OR u.username = :username)
              AND (:sourceName = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :sourceName, '%')))
              AND (:filename   = '' OR LOWER(l.filename) LIKE LOWER(CONCAT('%', :filename, '%')))
              AND (:userFilter = '' OR LOWER(u.username) LIKE LOWER(CONCAT('%', :userFilter, '%')))
              AND (:status     = '' OR l.status = :status)
        """,
    )
    fun findFiltered(
        username: String,
        sourceName: String,
        filename: String,
        userFilter: String,
        status: String,
        pageable: Pageable,
    ): Page<ImportLog>
}

@Repository
interface ImportLogErrorRepository : JpaRepository<ImportLogError, Long> {
    fun findAllByLogId(logId: Long): List<ImportLogError>
}
