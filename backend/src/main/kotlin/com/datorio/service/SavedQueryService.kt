package com.datorio.service

import com.datorio.datasource.ConnectionManager
import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.query.compiler.ParameterResolver
import com.datorio.query.compiler.SqlCompiler
import com.datorio.query.model.VisualQuery
import com.datorio.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class SavedQueryService(
    private val savedQueryRepository: SavedQueryRepository,
    private val queryVersionRepository: QueryVersionRepository,
    private val queryExecutionRepository: QueryExecutionRepository,
    private val dataSourceRepository: DataSourceRepository,
    private val userRepository: UserRepository,
    private val connectionManager: ConnectionManager,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ════════════════════════════════════════════
    //  CRUD
    // ════════════════════════════════════════════

    fun findAll(datasourceId: Long? = null, folderId: Long? = null, page: Int = 0, size: Int = 50): PageResponse<SavedQueryListItem> {
        val pageResult = savedQueryRepository.findFiltered(
            datasourceId, folderId, PageRequest.of(page, size)
        )
        return PageResponse(
            content = pageResult.content.map { it.toListItem() },
            page = page,
            size = size,
            totalElements = pageResult.totalElements,
            totalPages = pageResult.totalPages
        )
    }

    fun findById(id: Long): SavedQueryResponse {
        return getEntity(id).toResponse()
    }

    @Transactional
    fun create(request: SavedQueryCreateRequest, username: String): SavedQueryResponse {
        val ds = dataSourceRepository.findById(request.datasourceId)
            .orElseThrow { NoSuchElementException("DataSource not found: ${request.datasourceId}") }
        val user = userRepository.findByUsername(username).orElse(null)
        val folder = request.folderId?.let { fid ->
            // Folder loading deferred to repository lookup
            null // simplified for now; use QueryFolderRepository in production
        }

        // Compile visual query if needed
        val (sqlText, compiledSql) = when (request.queryMode) {
            QueryMode.RAW -> Pair(request.sqlText!!, null)
            QueryMode.VISUAL -> {
                val compiler = SqlCompiler(ds.type)
                val result = compiler.compile(request.visualQuery!!)
                Pair(result.sql, result.sql)
            }
        }

        val query = SavedQuery(
            name = request.name,
            description = request.description,
            datasource = ds,
            sqlText = sqlText,
            queryMode = request.queryMode,
            visualQuery = request.visualQuery?.let { objectMapper.convertValue(it, Map::class.java) as Map<String, Any> },
            compiledSql = compiledSql,
            parameters = request.parameters.map { objectMapper.convertValue(it, Map::class.java) as Map<String, Any> },
            createdBy = user
        )

        val saved = savedQueryRepository.save(query)

        // Create initial version
        val version = createVersion(saved, user, "Initial version")
        saved.currentVersion = version
        savedQueryRepository.save(saved)

        log.info("Saved query created: '{}' (id={})", saved.name, saved.id)
        return saved.toResponse()
    }

    @Transactional
    fun update(id: Long, request: SavedQueryUpdateRequest, username: String): SavedQueryResponse {
        val query = getEntity(id)
        val user = userRepository.findByUsername(username).orElse(null)
        val ds = query.datasource

        request.name?.let { query.name = it }
        request.description?.let { query.description = it }

        if (request.queryMode != null || request.sqlText != null || request.visualQuery != null) {
            val mode = request.queryMode ?: query.queryMode
            query.queryMode = mode

            when (mode) {
                QueryMode.RAW -> {
                    request.sqlText?.let { query.sqlText = it }
                    query.compiledSql = null
                }
                QueryMode.VISUAL -> {
                    request.visualQuery?.let { vq ->
                        val compiler = SqlCompiler(ds.type)
                        val result = compiler.compile(vq)
                        query.sqlText = result.sql
                        query.compiledSql = result.sql
                        query.visualQuery = objectMapper.convertValue(vq, Map::class.java) as Map<String, Any>
                    }
                }
            }

            // Create new version
            val version = createVersion(query, user, request.changeNote ?: "Updated")
            query.currentVersion = version
        }

        request.parameters?.let {
            query.parameters = it.map { p -> objectMapper.convertValue(p, Map::class.java) as Map<String, Any> }
        }

        query.updatedAt = OffsetDateTime.now()
        savedQueryRepository.save(query)
        return query.toResponse()
    }

    @Transactional
    fun delete(id: Long) {
        savedQueryRepository.deleteById(id)
        log.info("Saved query deleted: id={}", id)
    }

    @Transactional
    fun toggleFavorite(id: Long): Boolean {
        val query = getEntity(id)
        query.isFavorite = !query.isFavorite
        savedQueryRepository.save(query)
        return query.isFavorite
    }

    fun search(term: String): List<SavedQueryListItem> {
        return savedQueryRepository.search(term).map { it.toListItem() }
    }

    // ════════════════════════════════════════════
    //  Versioning
    // ════════════════════════════════════════════

    fun getVersions(queryId: Long): List<QueryVersionResponse> {
        return queryVersionRepository.findByQueryIdOrderByVersionNumberDesc(queryId)
            .map { it.toResponse() }
    }

    @Transactional
    fun restoreVersion(queryId: Long, versionId: Long, username: String): SavedQueryResponse {
        val query = getEntity(queryId)
        val version = queryVersionRepository.findById(versionId)
            .orElseThrow { NoSuchElementException("Version not found: $versionId") }

        require(version.query.id == queryId) { "Version does not belong to this query" }

        query.sqlText = version.sqlText ?: query.sqlText
        query.queryMode = version.queryMode
        query.visualQuery = version.visualQuery
        query.compiledSql = version.compiledSql
        query.updatedAt = OffsetDateTime.now()

        // Create a new version pointing to the restored state
        val user = userRepository.findByUsername(username).orElse(null)
        val newVersion = createVersion(query, user, "Restored from v${version.versionNumber}")
        query.currentVersion = newVersion
        savedQueryRepository.save(query)

        return query.toResponse()
    }

    // ════════════════════════════════════════════
    //  Execution
    // ════════════════════════════════════════════

    /**
     * Execute a saved query by ID with optional parameter overrides.
     */
    @Transactional
    fun executeSavedQuery(
        queryId: Long,
        parameters: Map<String, Any?> = emptyMap(),
        limit: Int = 1000,
        username: String,
        ipAddress: String? = null
    ): QueryResult {
        val query = getEntity(queryId)
        val ds = query.datasource
        val user = userRepository.findByUsername(username).orElse(null)

        // Resolve parameters
        val resolver = ParameterResolver(ds.type)
        val resolvedSql = resolver.resolve(query.sqlText, parameters)

        // Execute and audit
        return executeWithAudit(
            sql = resolvedSql,
            datasource = ds,
            user = user,
            savedQuery = query,
            parameters = parameters,
            limit = limit,
            ipAddress = ipAddress
        ).also {
            // Update query stats
            query.executionCount++
            query.lastExecutedAt = OffsetDateTime.now()
            val currentAvg = query.avgExecutionMs ?: 0L
            query.avgExecutionMs = if (currentAvg == 0L) it.executionTimeMs
                else (currentAvg + it.executionTimeMs) / 2
            savedQueryRepository.save(query)
        }
    }

    /**
     * Execute an ad-hoc SQL query (not saved) with audit logging.
     */
    @Transactional
    fun executeAdHocQuery(
        request: QueryExecuteRequest,
        username: String,
        ipAddress: String? = null
    ): QueryResult {
        val ds = dataSourceRepository.findById(request.datasourceId)
            .orElseThrow { NoSuchElementException("DataSource not found: ${request.datasourceId}") }
        val user = userRepository.findByUsername(username).orElse(null)

        // Resolve parameters if present
        val resolver = ParameterResolver(ds.type)
        val resolvedSql = resolver.resolve(request.sql, request.parameters)

        return executeWithAudit(
            sql = resolvedSql,
            datasource = ds,
            user = user,
            savedQuery = null,
            parameters = request.parameters,
            limit = request.limit,
            ipAddress = ipAddress
        )
    }

    /**
     * Compile a visual query (without executing) for preview.
     */
    fun compileVisualQuery(request: CompileQueryRequest): CompileQueryResponse {
        val ds = dataSourceRepository.findById(request.datasourceId)
            .orElseThrow { NoSuchElementException("DataSource not found: ${request.datasourceId}") }

        val compiler = SqlCompiler(ds.type)
        val errors = compiler.validate(request.visualQuery)
        if (errors.isNotEmpty()) {
            return CompileQueryResponse(sql = "", parameterNames = emptyList(), validationErrors = errors)
        }

        val result = compiler.compile(request.visualQuery)
        return CompileQueryResponse(
            sql = result.sql,
            parameterNames = result.parameterNames,
            validationErrors = emptyList()
        )
    }

    /**
     * Execute a visual query directly (compile + execute in one step).
     */
    @Transactional
    fun executeVisualQuery(
        request: ExecuteVisualQueryRequest,
        username: String,
        ipAddress: String? = null
    ): QueryResult {
        val ds = dataSourceRepository.findById(request.datasourceId)
            .orElseThrow { NoSuchElementException("DataSource not found: ${request.datasourceId}") }
        val user = userRepository.findByUsername(username).orElse(null)

        val compiler = SqlCompiler(ds.type)
        val errors = compiler.validate(request.visualQuery)
        require(errors.isEmpty()) { "Visual query validation failed: ${errors.joinToString("; ")}" }

        val compiled = compiler.compile(request.visualQuery)
        val resolver = ParameterResolver(ds.type)
        val resolvedSql = resolver.resolve(compiled.sql, request.parameters)

        return executeWithAudit(
            sql = resolvedSql,
            datasource = ds,
            user = user,
            savedQuery = null,
            parameters = request.parameters,
            limit = request.limit,
            ipAddress = ipAddress
        )
    }

    // ════════════════════════════════════════════
    //  Audit Log
    // ════════════════════════════════════════════

    fun getExecutionHistory(filter: QueryExecutionFilter): PageResponse<QueryExecutionResponse> {
        val from = filter.from?.let { OffsetDateTime.parse(it) }
        val to = filter.to?.let { OffsetDateTime.parse(it) }

        val page = queryExecutionRepository.findFiltered(
            filter.userId, filter.datasourceId, filter.status,
            from, to, PageRequest.of(filter.page, filter.size)
        )

        return PageResponse(
            content = page.content.map { it.toResponse() },
            page = filter.page,
            size = filter.size,
            totalElements = page.totalElements,
            totalPages = page.totalPages
        )
    }

    // ════════════════════════════════════════════
    //  Internal helpers
    // ════════════════════════════════════════════

    private fun executeWithAudit(
        sql: String,
        datasource: DataSource,
        user: User?,
        savedQuery: SavedQuery?,
        parameters: Map<String, Any?>,
        limit: Int,
        ipAddress: String?
    ): QueryResult {
        // Security: only SELECT/WITH allowed
        val normalized = sql.trim().uppercase()
        require(normalized.startsWith("SELECT") || normalized.startsWith("WITH")) {
            "Only SELECT queries are allowed"
        }

        val start = System.currentTimeMillis()
        return try {
            val result = connectionManager.executeQuery(datasource, sql, limit)
            val durationMs = System.currentTimeMillis() - start

            // Log success
            logExecution(user, datasource, savedQuery, sql, parameters,
                ExecutionStatus.SUCCESS, result.rowCount, durationMs, null, ipAddress)

            result
        } catch (e: Exception) {
            val durationMs = System.currentTimeMillis() - start

            // Log error
            logExecution(user, datasource, savedQuery, sql, parameters,
                ExecutionStatus.ERROR, null, durationMs, e.message, ipAddress)

            throw RuntimeException("Query execution failed: ${e.message}", e)
        }
    }

    private fun logExecution(
        user: User?, datasource: DataSource, savedQuery: SavedQuery?,
        sql: String, parameters: Map<String, Any?>,
        status: ExecutionStatus, rowCount: Int?, executionMs: Long,
        errorMessage: String?, ipAddress: String?
    ) {
        try {
            val log = QueryExecution(
                user = user,
                datasource = datasource,
                savedQuery = savedQuery,
                sqlText = sql,
                parameters = parameters,
                status = status,
                rowCount = rowCount,
                executionMs = executionMs,
                errorMessage = errorMessage,
                ipAddress = ipAddress
            )
            queryExecutionRepository.save(log)
        } catch (e: Exception) {
            this.log.warn("Failed to save query execution log: ${e.message}")
        }
    }

    private fun createVersion(query: SavedQuery, user: User?, changeNote: String): QueryVersion {
        val nextNumber = (queryVersionRepository.findMaxVersionNumber(query.id) ?: 0) + 1
        val version = QueryVersion(
            query = query,
            versionNumber = nextNumber,
            sqlText = query.sqlText,
            visualQuery = query.visualQuery,
            compiledSql = query.compiledSql,
            queryMode = query.queryMode,
            changeNote = changeNote,
            createdBy = user
        )
        return queryVersionRepository.save(version)
    }

    private fun getEntity(id: Long): SavedQuery {
        return savedQueryRepository.findById(id)
            .orElseThrow { NoSuchElementException("Saved query not found: $id") }
    }

    // ── Mappers ──

    private fun SavedQuery.toResponse() = SavedQueryResponse(
        id = id, name = name, description = description,
        datasourceId = datasource.id, datasourceName = datasource.name,
        queryMode = queryMode, sqlText = sqlText, compiledSql = compiledSql,
        parameters = parameters.map { p ->
            objectMapper.convertValue(p, QueryParameterDef::class.java)
        },
        isFavorite = isFavorite, executionCount = executionCount,
        avgExecutionMs = avgExecutionMs,
        lastExecutedAt = lastExecutedAt?.toString(),
        currentVersionNumber = currentVersion?.versionNumber,
        folderId = folder?.id,
        createdBy = createdBy?.username,
        createdAt = createdAt.toString(), updatedAt = updatedAt.toString()
    )

    private fun SavedQuery.toListItem() = SavedQueryListItem(
        id = id, name = name, description = description,
        datasourceName = datasource.name, queryMode = queryMode,
        isFavorite = isFavorite, executionCount = executionCount,
        lastExecutedAt = lastExecutedAt?.toString(),
        folderId = folder?.id, createdBy = createdBy?.username,
        updatedAt = updatedAt.toString()
    )

    private fun QueryVersion.toResponse() = QueryVersionResponse(
        id = id, versionNumber = versionNumber, queryMode = queryMode,
        sqlText = sqlText, compiledSql = compiledSql,
        changeNote = changeNote, createdBy = createdBy?.username,
        createdAt = createdAt.toString()
    )

    private fun QueryExecution.toResponse() = QueryExecutionResponse(
        id = id,
        username = user?.username,
        datasourceName = datasource?.name,
        savedQueryName = savedQuery?.name,
        sqlSnippet = sqlText.take(200) + if (sqlText.length > 200) "..." else "",
        status = status, rowCount = rowCount, executionMs = executionMs,
        errorMessage = errorMessage, createdAt = createdAt.toString()
    )
}
