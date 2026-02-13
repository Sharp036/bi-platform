package com.datorio.repository

import com.datorio.model.AuditLog
import com.datorio.model.Permission
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface PermissionRepository : JpaRepository<Permission, Long> {
    fun findByCode(code: String): Permission?
}

@Repository
interface AuditLogRepository : JpaRepository<AuditLog, Long> {

    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: Pageable): Page<AuditLog>

    fun findByActionOrderByCreatedAtDesc(action: String, pageable: Pageable): Page<AuditLog>

    @Query("""
        SELECT a FROM AuditLog a 
        WHERE (:userId IS NULL OR a.userId = :userId)
          AND (:action IS NULL OR a.action = :action)
          AND (:objectType IS NULL OR a.objectType = :objectType)
        ORDER BY a.createdAt DESC
    """)
    fun findFiltered(
        userId: Long?,
        action: String?,
        objectType: String?,
        pageable: Pageable
    ): Page<AuditLog>
}
