package com.datalens.model.dto

import com.datalens.model.DataSourceType
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

// ════════════════════════════════════════════
//  Auth DTOs
// ════════════════════════════════════════════

data class LoginRequest(
    @field:NotBlank val username: String,
    @field:NotBlank val password: String
)

data class RegisterRequest(
    @field:NotBlank @field:Size(min = 3, max = 100) val username: String,
    @field:NotBlank @field:Email val email: String,
    @field:NotBlank @field:Size(min = 6) val password: String,
    val displayName: String? = null
)

data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String = "Bearer",
    val expiresIn: Long
)

data class RefreshTokenRequest(
    @field:NotBlank val refreshToken: String
)

data class UserResponse(
    val id: Long,
    val username: String,
    val email: String,
    val displayName: String?,
    val roles: List<String>,
    val permissions: List<String>
)

// ════════════════════════════════════════════
//  DataSource DTOs
// ════════════════════════════════════════════

data class DataSourceCreateRequest(
    @field:NotBlank val name: String,
    val description: String? = null,
    val type: DataSourceType,
    @field:NotBlank val host: String,
    val port: Int,
    @field:NotBlank val databaseName: String,
    val username: String? = null,
    val password: String? = null,
    val extraParams: Map<String, Any> = emptyMap()
)

data class DataSourceResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val type: DataSourceType,
    val host: String,
    val port: Int,
    val databaseName: String,
    val username: String?,
    val isActive: Boolean,
    val createdAt: String
)

data class ConnectionTestResult(
    val success: Boolean,
    val message: String,
    val durationMs: Long
)

// ════════════════════════════════════════════
//  Query DTOs
// ════════════════════════════════════════════

data class QueryExecuteRequest(
    val datasourceId: Long,
    val sql: String,
    val parameters: Map<String, Any?> = emptyMap(),
    val limit: Int = 1000
)

data class QueryResult(
    val columns: List<ColumnMeta>,
    val rows: List<List<Any?>>,
    val rowCount: Int,
    val executionTimeMs: Long,
    val truncated: Boolean = false
)

data class ColumnMeta(
    val name: String,
    val type: String,
    val nullable: Boolean = true
)

// ════════════════════════════════════════════
//  Generic
// ════════════════════════════════════════════

data class ApiError(
    val status: Int,
    val error: String,
    val message: String,
    val timestamp: String = java.time.OffsetDateTime.now().toString()
)

data class PageResponse<T>(
    val content: List<T>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int
)
