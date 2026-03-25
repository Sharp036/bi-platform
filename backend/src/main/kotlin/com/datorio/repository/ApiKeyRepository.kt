package com.datorio.repository

import com.datorio.model.ApiKey
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.Optional

@Repository
interface ApiKeyRepository : JpaRepository<ApiKey, Long> {
    fun findByKeyHash(keyHash: String): Optional<ApiKey>
    fun findAllByUserId(userId: Long): List<ApiKey>
}
