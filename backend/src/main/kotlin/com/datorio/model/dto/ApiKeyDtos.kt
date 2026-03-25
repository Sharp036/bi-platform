package com.datorio.model.dto

import jakarta.validation.constraints.NotBlank

data class ApiKeyCreateRequest(
    @field:NotBlank val name: String,
    val expiresAt: String? = null,   // ISO-8601 date, null = no expiry
)

data class ApiKeyResponse(
    val id: Long,
    val name: String,
    val keyPrefix: String,
    val createdAt: String,
    val expiresAt: String?,
    val lastUsedAt: String?,
)

// Returned only once after creation — contains the plaintext key
data class ApiKeyCreatedResponse(
    val id: Long,
    val name: String,
    val keyPrefix: String,
    val key: String,        // full key — shown once, never stored
    val createdAt: String,
    val expiresAt: String?,
)
