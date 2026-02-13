package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.ScriptExecutionRepository
import com.datorio.repository.ScriptRepository
import com.datorio.scripting.ScriptEngine
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class ScriptService(
    private val scriptRepo: ScriptRepository,
    private val executionRepo: ScriptExecutionRepository,
    private val scriptEngine: ScriptEngine,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ── CRUD ──

    @Transactional
    fun create(request: ScriptCreateRequest): ScriptResponse {
        val script = Script(
            name = request.name,
            description = request.description,
            scriptType = request.scriptType,
            code = request.code,
            isLibrary = request.isLibrary,
            tags = objectMapper.writeValueAsString(request.tags),
            config = objectMapper.writeValueAsString(request.config)
        )
        return toResponse(scriptRepo.save(script))
    }

    @Transactional
    fun update(id: Long, request: ScriptUpdateRequest): ScriptResponse {
        val script = scriptRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Script not found: $id") }

        request.name?.let { script.name = it }
        request.description?.let { script.description = it }
        request.scriptType?.let { script.scriptType = it }
        request.code?.let { script.code = it }
        request.isActive?.let { script.isActive = it }
        request.isLibrary?.let { script.isLibrary = it }
        request.tags?.let { script.tags = objectMapper.writeValueAsString(it) }
        request.config?.let { script.config = objectMapper.writeValueAsString(it) }
        script.updatedAt = Instant.now()

        return toResponse(scriptRepo.save(script))
    }

    fun getById(id: Long): ScriptResponse {
        val script = scriptRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Script not found: $id") }
        return toResponse(script)
    }

    fun list(
        search: String? = null,
        type: ScriptType? = null,
        page: Int = 0,
        size: Int = 20
    ): PageResponse<ScriptSummaryResponse> {
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"))

        val result = when {
            !search.isNullOrBlank() && type != null ->
                scriptRepo.searchByType(search, type, pageable)
            !search.isNullOrBlank() ->
                scriptRepo.search(search, pageable)
            type != null ->
                scriptRepo.findByScriptTypeAndIsActiveTrue(type, pageable)
            else ->
                scriptRepo.findByIsActiveTrue(pageable)
        }

        return PageResponse(
            content = result.content.map { toSummary(it) },
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            page = page,
            size = size
        )
    }

    fun listLibraries(): List<ScriptSummaryResponse> {
        return scriptRepo.findByIsLibraryTrueAndIsActiveTrue().map { toSummary(it) }
    }

    @Transactional
    fun delete(id: Long) {
        val script = scriptRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Script not found: $id") }
        script.isActive = false
        script.updatedAt = Instant.now()
        scriptRepo.save(script)
    }

    // ── Execution ──

    /**
     * Execute a script by ID or ad-hoc code.
     */
    @Transactional
    fun execute(request: ScriptExecuteRequest, username: String): ScriptExecuteResponse {
        val code: String
        val scriptId: Long?
        val scriptName: String?

        if (request.scriptId != null) {
            val script = scriptRepo.findById(request.scriptId)
                .orElseThrow { IllegalArgumentException("Script not found: ${request.scriptId}") }
            code = script.code
            scriptId = script.id
            scriptName = script.name
        } else if (!request.code.isNullOrBlank()) {
            code = request.code
            scriptId = null
            scriptName = "ad-hoc"
        } else {
            throw IllegalArgumentException("Either scriptId or code must be provided")
        }

        // Load library scripts
        val libraryCode = if (request.libraries.isNotEmpty()) {
            val libs = scriptRepo.findAllById(request.libraries)
                .filter { it.isActive && it.isLibrary }
                .sortedBy { it.id }
            libs.joinToString("\n\n") { "// Library: ${it.name}\n${it.code}" }
        } else null

        // Build data input
        val dataInput = request.input?.let {
            ScriptEngine.DataInput(
                columns = it.columns,
                rows = it.rows,
                parameters = it.parameters
            )
        }

        // Execute
        val result = scriptEngine.execute(code, dataInput, libraryCode)

        // Log execution
        val execution = ScriptExecution(
            scriptId = scriptId,
            scriptName = scriptName,
            contextType = "ADHOC",
            status = if (result.success) ScriptExecStatus.SUCCESS else ScriptExecStatus.ERROR,
            executionMs = result.executionMs,
            inputRows = request.input?.rows?.size,
            outputRows = result.rows?.size,
            errorMessage = result.error,
            executedBy = username
        )
        executionRepo.save(execution)

        return ScriptExecuteResponse(
            output = result.output,
            columns = result.columns,
            rows = result.rows,
            logs = result.logs,
            executionMs = result.executionMs,
            status = if (result.success) ScriptExecStatus.SUCCESS else ScriptExecStatus.ERROR
        )
    }

    /**
     * Execute a transform script on widget data (called from ReportRenderService).
     */
    fun executeTransform(
        scriptId: Long,
        columns: List<String>,
        rows: List<List<Any?>>,
        parameters: Map<String, Any?>,
        username: String
    ): Pair<List<String>, List<List<Any?>>> {
        val script = scriptRepo.findById(scriptId)
            .orElseThrow { IllegalArgumentException("Transform script not found: $scriptId") }

        if (!script.isActive) {
            log.warn("Transform script {} is inactive, skipping", scriptId)
            return Pair(columns, rows)
        }

        val input = ScriptEngine.DataInput(columns, rows, parameters)
        val result = scriptEngine.execute(script.code, input)

        // Log
        val execution = ScriptExecution(
            scriptId = script.id,
            scriptName = script.name,
            contextType = "WIDGET",
            status = if (result.success) ScriptExecStatus.SUCCESS else ScriptExecStatus.ERROR,
            executionMs = result.executionMs,
            inputRows = rows.size,
            outputRows = result.rows?.size,
            errorMessage = result.error,
            executedBy = username
        )
        executionRepo.save(execution)

        return if (result.success && result.columns != null && result.rows != null) {
            Pair(result.columns, result.rows)
        } else {
            log.warn("Transform script {} failed: {}, using original data", scriptId, result.error)
            Pair(columns, rows)
        }
    }

    /**
     * Get execution history for a script.
     */
    fun getExecutions(scriptId: Long, page: Int = 0, size: Int = 20): List<ScriptExecutionResponse> {
        return executionRepo.findByScriptIdOrderByCreatedAtDesc(scriptId, PageRequest.of(page, size))
            .content.map { toExecResponse(it) }
    }

    /**
     * Get recent executions across all scripts.
     */
    fun getRecentExecutions(page: Int = 0, size: Int = 20): List<ScriptExecutionResponse> {
        return executionRepo.findRecent(PageRequest.of(page, size))
            .content.map { toExecResponse(it) }
    }

    // ── Mappers ──

    private fun toResponse(s: Script) = ScriptResponse(
        id = s.id, name = s.name, description = s.description,
        scriptType = s.scriptType, code = s.code,
        isActive = s.isActive, isLibrary = s.isLibrary,
        tags = parseTags(s.tags), config = parseConfig(s.config),
        createdBy = s.createdBy, updatedBy = s.updatedBy,
        createdAt = s.createdAt, updatedAt = s.updatedAt
    )

    private fun toSummary(s: Script) = ScriptSummaryResponse(
        id = s.id, name = s.name, description = s.description,
        scriptType = s.scriptType, isActive = s.isActive,
        isLibrary = s.isLibrary, tags = parseTags(s.tags),
        updatedAt = s.updatedAt
    )

    private fun toExecResponse(e: ScriptExecution) = ScriptExecutionResponse(
        id = e.id, scriptId = e.scriptId, scriptName = e.scriptName,
        contextType = e.contextType, contextId = e.contextId,
        status = e.status, executionMs = e.executionMs,
        inputRows = e.inputRows, outputRows = e.outputRows,
        errorMessage = e.errorMessage, executedBy = e.executedBy,
        createdAt = e.createdAt
    )

    private fun parseTags(json: String): List<String> = try {
        objectMapper.readValue(json)
    } catch (e: Exception) { emptyList() }

    private fun parseConfig(json: String): Map<String, Any?> = try {
        objectMapper.readValue(json)
    } catch (e: Exception) { emptyMap() }
}
