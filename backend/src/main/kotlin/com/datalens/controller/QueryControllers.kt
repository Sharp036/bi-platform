package com.datalens.controller

import com.datalens.model.dto.*
import com.datalens.service.SavedQueryService
import com.datalens.service.SchemaService
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

// ════════════════════════════════════════════════════════
//  Schema & Metadata Controller
// ════════════════════════════════════════════════════════

@RestController
@RequestMapping("/schema")
class SchemaController(
    private val schemaService: SchemaService
) {
    /** Get all tables/columns for a datasource (cached) */
    @GetMapping("/datasources/{id}")
    @PreAuthorize("hasAuthority('DATASOURCE_VIEW')")
    fun getSchema(
        @PathVariable id: Long,
        @RequestParam(defaultValue = "false") forceRefresh: Boolean
    ): ResponseEntity<SchemaInfoResponse> {
        return ResponseEntity.ok(schemaService.getSchema(id, forceRefresh))
    }

    /** Get columns for a specific table */
    @GetMapping("/datasources/{id}/tables/{tableName}/columns")
    @PreAuthorize("hasAuthority('DATASOURCE_VIEW')")
    fun getTableColumns(
        @PathVariable id: Long,
        @PathVariable tableName: String,
        @RequestParam(required = false) schema: String?
    ): ResponseEntity<List<ColumnMetadata>> {
        return ResponseEntity.ok(schemaService.getTableColumns(id, tableName, schema))
    }

    /** Preview first N rows of a table */
    @PostMapping("/preview")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun previewTable(@Valid @RequestBody request: TablePreviewRequest): ResponseEntity<QueryResult> {
        return ResponseEntity.ok(schemaService.previewTable(request))
    }

    /** Invalidate schema cache for a datasource */
    @PostMapping("/datasources/{id}/refresh")
    @PreAuthorize("hasAuthority('DATASOURCE_EDIT')")
    fun refreshCache(@PathVariable id: Long): ResponseEntity<SchemaInfoResponse> {
        return ResponseEntity.ok(schemaService.getSchema(id, forceRefresh = true))
    }
}

// ════════════════════════════════════════════════════════
//  Visual Query Builder Controller
// ════════════════════════════════════════════════════════

@RestController
@RequestMapping("/query-builder")
class QueryBuilderController(
    private val savedQueryService: SavedQueryService
) {
    /** Compile a visual query to SQL (preview without executing) */
    @PostMapping("/compile")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun compile(@Valid @RequestBody request: CompileQueryRequest): ResponseEntity<CompileQueryResponse> {
        return ResponseEntity.ok(savedQueryService.compileVisualQuery(request))
    }

    /** Compile and execute a visual query in one step */
    @PostMapping("/execute")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun executeVisual(
        @Valid @RequestBody request: ExecuteVisualQueryRequest,
        @AuthenticationPrincipal user: UserDetails,
        httpRequest: HttpServletRequest
    ): ResponseEntity<QueryResult> {
        return ResponseEntity.ok(
            savedQueryService.executeVisualQuery(
                request, user.username, httpRequest.remoteAddr
            )
        )
    }
}

// ════════════════════════════════════════════════════════
//  Saved Queries Controller
// ════════════════════════════════════════════════════════

@RestController
@RequestMapping("/queries")
class SavedQueryController(
    private val savedQueryService: SavedQueryService
) {
    /** List saved queries with filtering and pagination */
    @GetMapping
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun list(
        @RequestParam(required = false) datasourceId: Long?,
        @RequestParam(required = false) folderId: Long?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int
    ): ResponseEntity<PageResponse<SavedQueryListItem>> {
        return ResponseEntity.ok(savedQueryService.findAll(datasourceId, folderId, page, size))
    }

    /** Get a single saved query with full details */
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun get(@PathVariable id: Long): ResponseEntity<SavedQueryResponse> {
        return ResponseEntity.ok(savedQueryService.findById(id))
    }

    /** Create a new saved query */
    @PostMapping
    @PreAuthorize("hasAuthority('QUERY_SAVE')")
    fun create(
        @Valid @RequestBody request: SavedQueryCreateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<SavedQueryResponse> {
        return ResponseEntity.ok(savedQueryService.create(request, user.username))
    }

    /** Update a saved query (creates a new version) */
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('QUERY_SAVE')")
    fun update(
        @PathVariable id: Long,
        @Valid @RequestBody request: SavedQueryUpdateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<SavedQueryResponse> {
        return ResponseEntity.ok(savedQueryService.update(id, request, user.username))
    }

    /** Delete a saved query */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('QUERY_SAVE')")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        savedQueryService.delete(id)
        return ResponseEntity.noContent().build()
    }

    /** Toggle favorite status */
    @PostMapping("/{id}/favorite")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun toggleFavorite(@PathVariable id: Long): ResponseEntity<Map<String, Boolean>> {
        val isFavorite = savedQueryService.toggleFavorite(id)
        return ResponseEntity.ok(mapOf("isFavorite" to isFavorite))
    }

    /** Search saved queries by name */
    @GetMapping("/search")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun search(@RequestParam q: String): ResponseEntity<List<SavedQueryListItem>> {
        return ResponseEntity.ok(savedQueryService.search(q))
    }

    /** Execute a saved query */
    @PostMapping("/{id}/execute")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun execute(
        @PathVariable id: Long,
        @RequestBody(required = false) parameters: Map<String, Any?>?,
        @RequestParam(defaultValue = "1000") limit: Int,
        @AuthenticationPrincipal user: UserDetails,
        httpRequest: HttpServletRequest
    ): ResponseEntity<QueryResult> {
        return ResponseEntity.ok(
            savedQueryService.executeSavedQuery(
                id, parameters ?: emptyMap(), limit, user.username, httpRequest.remoteAddr
            )
        )
    }

    // ── Versioning ──

    /** List all versions of a saved query */
    @GetMapping("/{id}/versions")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun getVersions(@PathVariable id: Long): ResponseEntity<List<QueryVersionResponse>> {
        return ResponseEntity.ok(savedQueryService.getVersions(id))
    }

    /** Restore a previous version */
    @PostMapping("/{id}/versions/{versionId}/restore")
    @PreAuthorize("hasAuthority('QUERY_SAVE')")
    fun restoreVersion(
        @PathVariable id: Long,
        @PathVariable versionId: Long,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<SavedQueryResponse> {
        return ResponseEntity.ok(savedQueryService.restoreVersion(id, versionId, user.username))
    }
}

// ════════════════════════════════════════════════════════
//  Ad-Hoc Query Execution (enhanced from Phase 1)
// ════════════════════════════════════════════════════════

@RestController
@RequestMapping("/query")
class QueryExecutionController(
    private val savedQueryService: SavedQueryService
) {
    /** Execute an ad-hoc SQL query with audit logging */
    @PostMapping("/execute")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun execute(
        @Valid @RequestBody request: QueryExecuteRequest,
        @AuthenticationPrincipal user: UserDetails,
        httpRequest: HttpServletRequest
    ): ResponseEntity<QueryResult> {
        return ResponseEntity.ok(
            savedQueryService.executeAdHocQuery(request, user.username, httpRequest.remoteAddr)
        )
    }
}

// ════════════════════════════════════════════════════════
//  Audit Log Controller
// ════════════════════════════════════════════════════════

@RestController
@RequestMapping("/audit/queries")
class QueryAuditController(
    private val savedQueryService: SavedQueryService
) {
    /** Query execution history with filtering */
    @GetMapping
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN') or hasRole('ADMIN')")
    fun getExecutionHistory(
        @RequestParam(required = false) userId: Long?,
        @RequestParam(required = false) datasourceId: Long?,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) from: String?,
        @RequestParam(required = false) to: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int
    ): ResponseEntity<PageResponse<QueryExecutionResponse>> {
        val filter = QueryExecutionFilter(
            userId = userId,
            datasourceId = datasourceId,
            status = status?.let { com.datalens.model.ExecutionStatus.valueOf(it.uppercase()) },
            from = from, to = to,
            page = page, size = size
        )
        return ResponseEntity.ok(savedQueryService.getExecutionHistory(filter))
    }
}
