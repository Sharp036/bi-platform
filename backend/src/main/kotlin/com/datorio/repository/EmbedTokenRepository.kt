package com.datorio.repository

import com.datorio.model.EmbedToken
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface EmbedTokenRepository : JpaRepository<EmbedToken, Long> {
    fun findByToken(token: String): Optional<EmbedToken>
    fun findByReportIdAndIsActiveTrue(reportId: Long): List<EmbedToken>
    fun findByIsActiveTrue(): List<EmbedToken>
}
