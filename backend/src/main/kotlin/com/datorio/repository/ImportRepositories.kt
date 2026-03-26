package com.datorio.repository

import com.datorio.model.ImportLog
import com.datorio.model.ImportLogError
import com.datorio.model.ImportSource
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
    fun findAllByOrderByUploadedAtDesc(): List<ImportLog>
    fun findAllByUploadedByUsernameOrderByUploadedAtDesc(username: String): List<ImportLog>
}

@Repository
interface ImportLogErrorRepository : JpaRepository<ImportLogError, Long> {
    fun findAllByLogId(logId: Long): List<ImportLogError>
}
