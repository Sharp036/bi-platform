package com.datorio.service

import com.datorio.model.EmbedToken
import com.datorio.model.dto.*
import com.datorio.repository.EmbedTokenRepository
import com.datorio.repository.ReportRepository
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Base64

@Service
class EmbedService(
    private val embedRepo: EmbedTokenRepository,
    private val reportRepo: ReportRepository,
    private val renderService: ReportRenderService,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val random = SecureRandom()

    @Value("\${datorio.embed.base-url:}")
    private var baseUrl: String = ""

    @Transactional
    fun createToken(request: EmbedTokenCreateRequest): EmbedTokenResponse {
        val report = reportRepo.findById(request.reportId)
            .orElseThrow { IllegalArgumentException("Report not found: ${request.reportId}") }

        val token = generateToken()
        val expiresAt = request.expiresInDays?.let {
            Instant.now().plus(it.toLong(), ChronoUnit.DAYS)
        }

        val embed = EmbedToken(
            reportId = request.reportId,
            token = token,
            label = request.label,
            parameters = objectMapper.writeValueAsString(request.parameters),
            expiresAt = expiresAt,
            allowedDomains = request.allowedDomains
        )
        val saved = embedRepo.save(embed)

        log.info("Created embed token for report '{}' (id={})", report.name, report.id)
        return toResponse(saved, report.name)
    }

    fun getToken(id: Long): EmbedTokenResponse {
        val embed = embedRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Embed token not found: $id") }
        val reportName = reportRepo.findById(embed.reportId).map { it.name }.orElse(null)
        return toResponse(embed, reportName)
    }

    fun listTokensForReport(reportId: Long): List<EmbedTokenResponse> {
        return embedRepo.findByReportIdAndIsActiveTrue(reportId).map { embed ->
            val reportName = reportRepo.findById(embed.reportId).map { it.name }.orElse(null)
            toResponse(embed, reportName)
        }
    }

    @Transactional
    fun revokeToken(id: Long) {
        val embed = embedRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Embed token not found: $id") }
        embed.isActive = false
        embedRepo.save(embed)
        log.info("Revoked embed token id={}", id)
    }

    /**
     * Render a report using an embed token (no auth required).
     */
    fun renderByToken(token: String, extraParams: Map<String, Any?> = emptyMap()): RenderReportResponse {
        val embed = embedRepo.findByToken(token)
            .orElseThrow { IllegalArgumentException("Invalid embed token") }

        if (!embed.isActive) {
            throw IllegalArgumentException("Embed token is revoked")
        }
        if (embed.expiresAt != null && Instant.now().isAfter(embed.expiresAt)) {
            throw IllegalArgumentException("Embed token has expired")
        }

        // Merge token parameters with extra parameters (token params take priority)
        val tokenParams: Map<String, Any?> = try {
            objectMapper.readValue(embed.parameters)
        } catch (_: Exception) { emptyMap() }

        val mergedParams = extraParams + tokenParams

        return renderService.renderReport(
            embed.reportId,
            RenderReportRequest(mergedParams),
            "embed"
        )
    }

    /**
     * Check if origin is allowed for this token.
     */
    fun isOriginAllowed(token: String, origin: String?): Boolean {
        if (origin == null) return true
        val embed = embedRepo.findByToken(token).orElse(null) ?: return false
        if (embed.allowedDomains.isNullOrBlank()) return true
        val allowed = embed.allowedDomains!!.split(",").map { it.trim() }
        return allowed.any { origin.contains(it) }
    }

    // ── Helpers ──

    private fun generateToken(): String {
        val bytes = ByteArray(48)
        random.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun toResponse(embed: EmbedToken, reportName: String?): EmbedTokenResponse {
        val params: Map<String, Any?> = try {
            objectMapper.readValue(embed.parameters)
        } catch (_: Exception) { emptyMap() }

        val embedUrl = if (baseUrl.isNotBlank()) {
            "$baseUrl/embed/${embed.token}"
        } else {
            "/embed/${embed.token}"
        }

        return EmbedTokenResponse(
            id = embed.id,
            reportId = embed.reportId,
            reportName = reportName,
            token = embed.token,
            label = embed.label,
            parameters = params,
            embedUrl = embedUrl,
            expiresAt = embed.expiresAt,
            isActive = embed.isActive,
            allowedDomains = embed.allowedDomains,
            createdAt = embed.createdAt
        )
    }
}
