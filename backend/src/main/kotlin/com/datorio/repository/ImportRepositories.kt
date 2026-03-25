package com.datorio.repository

import com.datorio.model.ImportLog
import com.datorio.model.ImportLogError
import com.datorio.model.ImportSource
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface ImportSourceRepository : JpaRepository<ImportSource, Long>

@Repository
interface ImportLogRepository : JpaRepository<ImportLog, Long> {
    fun findAllByOrderByUploadedAtDesc(): List<ImportLog>
    fun findAllByUploadedByUsernameOrderByUploadedAtDesc(username: String): List<ImportLog>
}

@Repository
interface ImportLogErrorRepository : JpaRepository<ImportLogError, Long> {
    fun findAllByLogId(logId: Long): List<ImportLogError>
}
