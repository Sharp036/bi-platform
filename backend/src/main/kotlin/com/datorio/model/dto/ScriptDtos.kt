package com.datorio.model.dto

import com.datorio.model.ScriptType
import com.datorio.model.ScriptExecStatus
import java.time.Instant

// ── Create / Update ──

data class ScriptCreateRequest(
    val name: String,
    val description: String? = null,
    val scriptType: ScriptType = ScriptType.TRANSFORM,
    val code: String,
    val isLibrary: Boolean = false,
    val tags: List<String> = emptyList(),
    val config: Map<String, Any?> = emptyMap()
)

data class ScriptUpdateRequest(
    val name: String? = null,
    val description: String? = null,
    val scriptType: ScriptType? = null,
    val code: String? = null,
    val isActive: Boolean? = null,
    val isLibrary: Boolean? = null,
    val tags: List<String>? = null,
    val config: Map<String, Any?>? = null
)

// ── Execution ──

data class ScriptExecuteRequest(
    val scriptId: Long? = null,
    val code: String? = null,       // ad-hoc execution
    val input: ScriptInput? = null,
    val libraries: List<Long> = emptyList() // library script IDs to include
)

data class ScriptInput(
    val columns: List<String> = emptyList(),
    val rows: List<List<Any?>> = emptyList(),
    val parameters: Map<String, Any?> = emptyMap()
)

data class ScriptExecuteResponse(
    val output: Any?,
    val columns: List<String>? = null,
    val rows: List<List<Any?>>? = null,
    val logs: List<String> = emptyList(),
    val executionMs: Long,
    val status: ScriptExecStatus
)

// ── Responses ──

data class ScriptResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val scriptType: ScriptType,
    val code: String,
    val isActive: Boolean,
    val isLibrary: Boolean,
    val tags: List<String>,
    val config: Map<String, Any?>,
    val createdBy: Long?,
    val updatedBy: Long?,
    val createdAt: Instant,
    val updatedAt: Instant
)

data class ScriptSummaryResponse(
    val id: Long,
    val name: String,
    val description: String?,
    val scriptType: ScriptType,
    val isActive: Boolean,
    val isLibrary: Boolean,
    val tags: List<String>,
    val updatedAt: Instant
)

data class ScriptExecutionResponse(
    val id: Long,
    val scriptId: Long?,
    val scriptName: String?,
    val contextType: String?,
    val contextId: Long?,
    val status: ScriptExecStatus,
    val executionMs: Long?,
    val inputRows: Int?,
    val outputRows: Int?,
    val errorMessage: String?,
    val executedBy: String?,
    val createdAt: Instant
)
