package com.datorio.controller

import com.datorio.model.ScriptType
import com.datorio.model.dto.*
import com.datorio.service.ScriptService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/scripts")
class ScriptController(
    private val scriptService: ScriptService
) {

    // ── CRUD ──

    @PostMapping
    fun create(@RequestBody request: ScriptCreateRequest): ResponseEntity<ScriptResponse> {
        return ResponseEntity.status(HttpStatus.CREATED).body(scriptService.create(request))
    }

    @GetMapping
    fun list(
        @RequestParam(required = false) search: String?,
        @RequestParam(required = false) type: ScriptType?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): PageResponse<ScriptSummaryResponse> {
        return scriptService.list(search, type, page, size)
    }

    @GetMapping("/libraries")
    fun listLibraries(): List<ScriptSummaryResponse> {
        return scriptService.listLibraries()
    }

    @GetMapping("/{id}")
    fun getById(@PathVariable id: Long): ScriptResponse {
        return scriptService.getById(id)
    }

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @RequestBody request: ScriptUpdateRequest): ScriptResponse {
        return scriptService.update(id, request)
    }

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        scriptService.delete(id)
        return ResponseEntity.noContent().build()
    }

    // ── Execution ──

    @PostMapping("/execute")
    fun execute(
        @RequestBody request: ScriptExecuteRequest,
        auth: Authentication
    ): ScriptExecuteResponse {
        return scriptService.execute(request, auth.name)
    }

    @PostMapping("/{id}/execute")
    fun executeById(
        @PathVariable id: Long,
        @RequestBody(required = false) request: ScriptExecuteRequest?,
        auth: Authentication
    ): ScriptExecuteResponse {
        val req = (request ?: ScriptExecuteRequest()).copy(scriptId = id)
        return scriptService.execute(req, auth.name)
    }

    // ── Execution History ──

    @GetMapping("/{id}/executions")
    fun getExecutions(
        @PathVariable id: Long,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): List<ScriptExecutionResponse> {
        return scriptService.getExecutions(id, page, size)
    }

    @GetMapping("/executions/recent")
    fun getRecentExecutions(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): List<ScriptExecutionResponse> {
        return scriptService.getRecentExecutions(page, size)
    }
}
