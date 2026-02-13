package com.datorio.model.dto

import java.time.Instant

// ═══════════════════════════════════════════════
//  Export DTOs
// ═══════════════════════════════════════════════

data class ExportRequest(
    val format: String = "CSV",             // CSV, EXCEL, PDF
    val parameters: Map<String, Any?> = emptyMap(),
    val widgetIds: List<Long>? = null,      // null = all widgets
    val includeHeaders: Boolean = true,
    val sheetPerWidget: Boolean = true      // Excel: separate sheet per widget
)

data class ExportStatusResponse(
    val snapshotId: Long,
    val status: String,
    val format: String,
    val downloadUrl: String?
)

// ═══════════════════════════════════════════════
//  Email DTOs
// ═══════════════════════════════════════════════

data class EmailDeliveryRequest(
    val reportId: Long,
    val recipients: List<String>,
    val subject: String? = null,
    val body: String? = null,
    val format: String = "CSV",
    val parameters: Map<String, Any?> = emptyMap()
)

data class EmailDeliveryResponse(
    val success: Boolean,
    val recipientCount: Int,
    val message: String
)

// ═══════════════════════════════════════════════
//  Embed DTOs
// ═══════════════════════════════════════════════

data class EmbedTokenCreateRequest(
    val reportId: Long,
    val label: String? = null,
    val parameters: Map<String, Any?> = emptyMap(),
    val expiresInDays: Int? = null,          // null = no expiry
    val allowedDomains: String? = null
)

data class EmbedTokenResponse(
    val id: Long,
    val reportId: Long,
    val reportName: String?,
    val token: String,
    val label: String?,
    val parameters: Map<String, Any?>,
    val embedUrl: String,
    val expiresAt: Instant?,
    val isActive: Boolean,
    val allowedDomains: String?,
    val createdAt: Instant
)
