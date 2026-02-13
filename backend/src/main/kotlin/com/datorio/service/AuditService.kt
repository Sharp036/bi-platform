package com.datorio.service

import com.datorio.model.AuditLog
import com.datorio.model.dto.AuditLogFilter
import com.datorio.model.dto.AuditLogItem
import com.datorio.repository.AuditLogRepository
import com.datorio.repository.UserRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

@Service
class AuditService(
    private val auditLogRepository: AuditLogRepository,
    private val userRepository: UserRepository
) {

    fun log(
        username: String,
        action: String,
        objectType: String? = null,
        objectId: Long? = null,
        details: Map<String, Any?> = emptyMap(),
        ipAddress: String? = null
    ) {
        val userId = userRepository.findByUsername(username).map { it.id }.orElse(null)
        val entry = AuditLog(
            userId = userId,
            action = action,
            objectType = objectType,
            objectId = objectId,
            details = details,
            ipAddress = ipAddress
        )
        auditLogRepository.save(entry)
    }

    fun getAuditLog(filter: AuditLogFilter, page: Int, size: Int): Page<AuditLogItem> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))

        val logPage = auditLogRepository.findFiltered(
            userId = filter.userId,
            action = filter.action,
            objectType = filter.objectType,
            pageable = pageable
        )

        // Batch-load usernames
        val userIds = logPage.content.mapNotNull { it.userId }.distinct()
        val userMap = if (userIds.isNotEmpty()) {
            userRepository.findAllById(userIds).associate { it.id to it.username }
        } else emptyMap()

        return logPage.map { entry ->
            AuditLogItem(
                id = entry.id,
                userId = entry.userId,
                username = entry.userId?.let { userMap[it] },
                action = entry.action,
                objectType = entry.objectType,
                objectId = entry.objectId,
                details = entry.details,
                ipAddress = entry.ipAddress,
                createdAt = entry.createdAt
            )
        }
    }
}
