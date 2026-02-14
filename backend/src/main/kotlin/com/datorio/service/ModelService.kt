package com.datorio.service

import com.datorio.datasource.ConnectionManager
import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class ModelService(
    private val modelRepo: DataModelRepository,
    private val tableRepo: ModelTableRepository,
    private val fieldRepo: ModelFieldRepository,
    private val relationshipRepo: ModelRelationshipRepository,
    private val dataSourceRepo: DataSourceRepository,
    private val connectionManager: ConnectionManager,
    private val schemaService: SchemaService
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ═══════════════════════════════════════════
    //  Data Model CRUD
    // ═══════════════════════════════════════════

    fun getModels(userId: Long): List<DataModelResponse> =
        modelRepo.findAccessibleByUser(userId).map { it.toListResponse() }

    fun getModelDetail(id: Long): DataModelDetailResponse {
        val model = modelRepo.findById(id)
            .orElseThrow { NoSuchElementException("Model not found: $id") }
        val tables = tableRepo.findByModelIdOrderBySortOrder(id)
        val allFields = fieldRepo.findByModelId(id)
        val fieldsByTable = allFields.groupBy { it.modelTableId }
        val relationships = relationshipRepo.findByModelId(id)
        val tableAliases = tables.associate { it.id to it.alias }
        val dsName = dataSourceRepo.findById(model.datasourceId).map { it.name }.orElse(null)

        return DataModelDetailResponse(
            id = model.id, name = model.name, description = model.description,
            datasourceId = model.datasourceId, datasourceName = dsName,
            ownerId = model.ownerId, isPublished = model.isPublished,
            tables = tables.map { t ->
                t.toResponse(fieldsByTable[t.id] ?: emptyList())
            },
            relationships = relationships.map { r ->
                r.toResponse(tableAliases[r.leftTableId], tableAliases[r.rightTableId])
            },
            createdAt = model.createdAt, updatedAt = model.updatedAt
        )
    }

    @Transactional
    fun createModel(userId: Long, req: DataModelCreateRequest): DataModelResponse {
        dataSourceRepo.findById(req.datasourceId)
            .orElseThrow { NoSuchElementException("DataSource not found: ${req.datasourceId}") }
        val model = DataModel(
            name = req.name, description = req.description,
            datasourceId = req.datasourceId, ownerId = userId
        )
        return modelRepo.save(model).toListResponse()
    }

    @Transactional
    fun updateModel(id: Long, req: DataModelUpdateRequest): DataModelResponse {
        val model = modelRepo.findById(id).orElseThrow { NoSuchElementException("Model not found: $id") }
        req.name?.let { model.name = it }
        req.description?.let { model.description = it }
        req.isPublished?.let { model.isPublished = it }
        model.updatedAt = OffsetDateTime.now()
        return modelRepo.save(model).toListResponse()
    }

    @Transactional
    fun deleteModel(id: Long) {
        modelRepo.deleteById(id)
    }

    // ═══════════════════════════════════════════
    //  Model Tables
    // ═══════════════════════════════════════════

    @Transactional
    fun addTable(modelId: Long, req: ModelTableRequest): ModelTableResponse {
        val table = ModelTable(
            modelId = modelId, tableSchema = req.tableSchema,
            tableName = req.tableName, alias = req.alias,
            label = req.label, description = req.description,
            isPrimary = req.isPrimary, sqlExpression = req.sqlExpression,
            sortOrder = req.sortOrder
        )
        val saved = tableRepo.save(table)
        return saved.toResponse(emptyList())
    }

    @Transactional
    fun removeTable(tableId: Long) {
        tableRepo.deleteById(tableId)
    }

    // ═══════════════════════════════════════════
    //  Model Fields
    // ═══════════════════════════════════════════

    @Transactional
    fun addField(tableId: Long, req: ModelFieldRequest): ModelFieldResponse {
        val table = tableRepo.findById(tableId).orElseThrow { NoSuchElementException("Table not found: $tableId") }
        val field = ModelField(
            modelTableId = tableId,
            columnName = req.columnName, fieldRole = req.fieldRole,
            label = req.label, description = req.description,
            dataType = req.dataType, aggregation = req.aggregation,
            expression = req.expression, format = req.format,
            hidden = req.hidden, sortOrder = req.sortOrder
        )
        return fieldRepo.save(field).toResponse(table.alias)
    }

    @Transactional
    fun updateField(fieldId: Long, req: ModelFieldRequest): ModelFieldResponse {
        val field = fieldRepo.findById(fieldId).orElseThrow { NoSuchElementException("Field not found: $fieldId") }
        field.columnName = req.columnName; field.fieldRole = req.fieldRole
        field.label = req.label; field.description = req.description
        field.dataType = req.dataType; field.aggregation = req.aggregation
        field.expression = req.expression; field.format = req.format
        field.hidden = req.hidden; field.sortOrder = req.sortOrder
        val saved = fieldRepo.save(field)
        val table = tableRepo.findById(saved.modelTableId).orElse(null)
        return saved.toResponse(table?.alias)
    }

    @Transactional
    fun removeField(fieldId: Long) { fieldRepo.deleteById(fieldId) }

    // ═══════════════════════════════════════════
    //  Model Relationships
    // ═══════════════════════════════════════════

    @Transactional
    fun addRelationship(modelId: Long, req: ModelRelationshipRequest): ModelRelationshipResponse {
        val rel = ModelRelationship(
            modelId = modelId,
            leftTableId = req.leftTableId, leftColumn = req.leftColumn,
            rightTableId = req.rightTableId, rightColumn = req.rightColumn,
            joinType = req.joinType, label = req.label
        )
        val saved = relationshipRepo.save(rel)
        val tables = tableRepo.findByModelIdOrderBySortOrder(modelId)
        val aliases = tables.associate { it.id to it.alias }
        return saved.toResponse(aliases[saved.leftTableId], aliases[saved.rightTableId])
    }

    @Transactional
    fun removeRelationship(relId: Long) { relationshipRepo.deleteById(relId) }

    // ═══════════════════════════════════════════
    //  Auto-Import from Schema
    // ═══════════════════════════════════════════

    @Transactional
    fun autoImport(modelId: Long, req: AutoImportRequest): DataModelDetailResponse {
        val model = modelRepo.findById(modelId).orElseThrow { NoSuchElementException("Model not found: $modelId") }
        val schema = schemaService.getSchema(model.datasourceId)

        for (tableName in req.tableNames) {
            val meta = schema.tables.firstOrNull { it.name == tableName } ?: continue

            // Check if table already exists
            val existing = tableRepo.findByModelIdOrderBySortOrder(modelId)
            if (existing.any { it.tableName == tableName }) continue

            val alias = tableName.take(3).lowercase() + (existing.size + 1)
            val isFirst = existing.isEmpty()

            val table = tableRepo.save(
                ModelTable(
                    modelId = modelId, tableSchema = req.tableSchema ?: meta.schema,
                    tableName = tableName, alias = alias,
                    label = humanize(tableName), isPrimary = isFirst,
                    sortOrder = existing.size
                )
            )

            // Import columns as fields
            meta.columns.forEachIndexed { idx, col ->
                val role = guessFieldRole(col.name, col.type)
                val agg = if (role == "MEASURE") guessAggregation(col.type) else null

                fieldRepo.save(
                    ModelField(
                        modelTableId = table.id,
                        columnName = col.name, fieldRole = role,
                        label = humanize(col.name), dataType = mapDataType(col.type),
                        aggregation = agg, sortOrder = idx
                    )
                )
            }
        }

        // Auto-detect relationships (FK naming convention: <table>_id)
        if (req.detectRelationships) {
            detectRelationships(modelId)
        }

        model.updatedAt = OffsetDateTime.now()
        modelRepo.save(model)

        return getModelDetail(modelId)
    }

    private fun detectRelationships(modelId: Long) {
        val tables = tableRepo.findByModelIdOrderBySortOrder(modelId)
        val existingRels = relationshipRepo.findByModelId(modelId)

        for (table in tables) {
            val fields = fieldRepo.findByModelTableIdOrderBySortOrder(table.id)
            for (field in fields) {
                val colName = field.columnName ?: continue
                if (!colName.endsWith("_id")) continue

                // e.g. "product_id" → look for table "products" or "product"
                val refName = colName.removeSuffix("_id")
                val refTable = tables.firstOrNull {
                    it.id != table.id && (it.tableName == refName || it.tableName == "${refName}s" || it.tableName == refName.removeSuffix("s"))
                } ?: continue

                // Check not already exists
                val alreadyExists = existingRels.any {
                    (it.leftTableId == table.id && it.rightTableId == refTable.id && it.leftColumn == colName) ||
                    (it.leftTableId == refTable.id && it.rightTableId == table.id && it.rightColumn == colName)
                }
                if (alreadyExists) continue

                relationshipRepo.save(
                    ModelRelationship(
                        modelId = modelId,
                        leftTableId = table.id, leftColumn = colName,
                        rightTableId = refTable.id, rightColumn = "id",
                        joinType = "LEFT",
                        label = "${table.alias}.${colName} → ${refTable.alias}.id"
                    )
                )
            }
        }
    }

    // ═══════════════════════════════════════════
    //  Explore: Generate SQL and Execute
    // ═══════════════════════════════════════════

    fun explore(req: ExploreRequest): ExploreResponse {
        val model = modelRepo.findById(req.modelId)
            .orElseThrow { NoSuchElementException("Model not found: ${req.modelId}") }
        val ds = dataSourceRepo.findById(model.datasourceId)
            .orElseThrow { NoSuchElementException("DataSource not found: ${model.datasourceId}") }

        // Load all model metadata
        val tables = tableRepo.findByModelIdOrderBySortOrder(req.modelId)
        val allFields = fieldRepo.findByModelId(req.modelId)
        val relationships = relationshipRepo.findByModelIdAndIsActiveTrue(req.modelId)

        val fieldMap = allFields.associateBy { it.id }
        val tableMap = tables.associateBy { it.id }

        // Resolve requested fields
        val selectedFields = req.fieldIds.mapNotNull { fieldMap[it] }
        if (selectedFields.isEmpty()) throw IllegalArgumentException("No valid fields selected")

        // Determine which tables are needed
        val neededTableIds = mutableSetOf<Long>()
        selectedFields.forEach { neededTableIds.add(it.modelTableId) }
        req.filters.forEach { f -> fieldMap[f.fieldId]?.let { neededTableIds.add(it.modelTableId) } }
        req.sorts.forEach { s -> fieldMap[s.fieldId]?.let { neededTableIds.add(it.modelTableId) } }

        // Determine primary table (FROM)
        val primaryTable = tables.firstOrNull { it.isPrimary && it.id in neededTableIds }
            ?: tableMap[neededTableIds.first()]
            ?: throw IllegalArgumentException("No tables found")

        // Build JOIN path using relationships (BFS from primary)
        val joinedTableIds = mutableSetOf(primaryTable.id)
        val joinsToApply = mutableListOf<JoinSpec>()
        buildJoinPath(primaryTable.id, neededTableIds, joinedTableIds, relationships, tableMap, joinsToApply)

        // Split fields into dimensions and measures
        val dimensions = selectedFields.filter { it.fieldRole != "MEASURE" }
        val measures = selectedFields.filter { it.fieldRole == "MEASURE" }

        // Build SQL
        val sql = buildExploreSql(primaryTable, dimensions, measures, joinsToApply,
            tableMap, req.filters, req.sorts, fieldMap, req.limit)

        log.info("Explore SQL:\n{}", sql)

        // Execute
        val startTime = System.currentTimeMillis()
        val result = connectionManager.executeQuery(ds, sql, req.limit)
        val elapsed = System.currentTimeMillis() - startTime

        val colNames = result.columns.map { it.name }
        val mappedRows = result.rows

        return ExploreResponse(
            sql = sql,
            columns = colNames,
            rows = mappedRows,
            rowCount = result.rowCount,
            executionMs = elapsed
        )
    }

    // ═══════════════════════════════════════════
    //  SQL Builder
    // ═══════════════════════════════════════════

    private data class JoinSpec(
        val tableId: Long, val tableName: String, val tableSchema: String?,
        val alias: String, val joinType: String,
        val leftAlias: String, val leftColumn: String,
        val rightAlias: String, val rightColumn: String
    )

    private fun buildJoinPath(
        fromTableId: Long, neededIds: Set<Long>,
        joinedIds: MutableSet<Long>,
        rels: List<ModelRelationship>,
        tableMap: Map<Long, ModelTable>,
        result: MutableList<JoinSpec>
    ) {
        var changed = true
        while (changed) {
            changed = false
            for (rel in rels) {
                val leftJoined = rel.leftTableId in joinedIds
                val rightJoined = rel.rightTableId in joinedIds
                val leftNeeded = rel.leftTableId in neededIds
                val rightNeeded = rel.rightTableId in neededIds

                if (leftJoined && !rightJoined && rightNeeded) {
                    val rt = tableMap[rel.rightTableId] ?: continue
                    val lt = tableMap[rel.leftTableId] ?: continue
                    result.add(JoinSpec(
                        rt.id, rt.tableName, rt.tableSchema, rt.alias, rel.joinType,
                        lt.alias, rel.leftColumn, rt.alias, rel.rightColumn
                    ))
                    joinedIds.add(rel.rightTableId)
                    changed = true
                } else if (rightJoined && !leftJoined && leftNeeded) {
                    val lt = tableMap[rel.leftTableId] ?: continue
                    val rt = tableMap[rel.rightTableId] ?: continue
                    result.add(JoinSpec(
                        lt.id, lt.tableName, lt.tableSchema, lt.alias, rel.joinType,
                        rt.alias, rel.rightColumn, lt.alias, rel.leftColumn
                    ))
                    joinedIds.add(rel.leftTableId)
                    changed = true
                }
            }
        }
    }

    private fun buildExploreSql(
        primaryTable: ModelTable,
        dimensions: List<ModelField>,
        measures: List<ModelField>,
        joins: List<JoinSpec>,
        tableMap: Map<Long, ModelTable>,
        filters: List<ExploreFilter>,
        sorts: List<ExploreSort>,
        fieldMap: Map<Long, ModelField>,
        limit: Int
    ): String {
        val sb = StringBuilder()

        // SELECT
        sb.append("SELECT ")
        val selectParts = mutableListOf<String>()

        dimensions.forEach { f ->
            val table = tableMap[f.modelTableId]
            val expr = f.expression ?: "${table?.alias}.${f.columnName}"
            selectParts.add("$expr AS \"${f.label}\"")
        }
        measures.forEach { f ->
            val table = tableMap[f.modelTableId]
            val col = f.expression ?: "${table?.alias}.${f.columnName}"
            val agg = f.aggregation ?: "SUM"
            selectParts.add("$agg($col) AS \"${f.label}\"")
        }

        sb.appendLine(selectParts.joinToString(", "))

        // FROM
        val fromSchema = if (primaryTable.tableSchema != null) "${primaryTable.tableSchema}." else ""
        val fromExpr = primaryTable.sqlExpression
            ?: "${fromSchema}${primaryTable.tableName}"
        sb.appendLine("FROM $fromExpr AS ${primaryTable.alias}")

        // JOINs
        joins.forEach { j ->
            val schema = if (j.tableSchema != null) "${j.tableSchema}." else ""
            sb.appendLine("${j.joinType} JOIN ${schema}${j.tableName} AS ${j.alias} ON ${j.leftAlias}.${j.leftColumn} = ${j.rightAlias}.${j.rightColumn}")
        }

        // WHERE
        if (filters.isNotEmpty()) {
            val whereParts = filters.mapNotNull { f ->
                val field = fieldMap[f.fieldId] ?: return@mapNotNull null
                val table = tableMap[field.modelTableId]
                val col = field.expression ?: "${table?.alias}.${field.columnName}"
                compileExploreFilter(col, f)
            }
            if (whereParts.isNotEmpty()) {
                sb.appendLine("WHERE ${whereParts.joinToString(" AND ")}")
            }
        }

        // GROUP BY (if there are measures)
        if (measures.isNotEmpty() && dimensions.isNotEmpty()) {
            val groupParts = dimensions.map { f ->
                val table = tableMap[f.modelTableId]
                f.expression ?: "${table?.alias}.${f.columnName}"
            }
            sb.appendLine("GROUP BY ${groupParts.joinToString(", ")}")
        }

        // ORDER BY
        if (sorts.isNotEmpty()) {
            val orderParts = sorts.mapNotNull { s ->
                val field = fieldMap[s.fieldId] ?: return@mapNotNull null
                "\"${field.label}\" ${s.direction}"
            }
            if (orderParts.isNotEmpty()) {
                sb.appendLine("ORDER BY ${orderParts.joinToString(", ")}")
            }
        }

        // LIMIT
        sb.appendLine("LIMIT $limit")

        return sb.toString().trim()
    }

    private fun compileExploreFilter(col: String, filter: ExploreFilter): String {
        return when (filter.operator.uppercase()) {
            "EQ" -> "$col = '${escapeSql(filter.value ?: "")}'"
            "NEQ" -> "$col <> '${escapeSql(filter.value ?: "")}'"
            "GT" -> "$col > '${escapeSql(filter.value ?: "")}'"
            "GTE" -> "$col >= '${escapeSql(filter.value ?: "")}'"
            "LT" -> "$col < '${escapeSql(filter.value ?: "")}'"
            "LTE" -> "$col <= '${escapeSql(filter.value ?: "")}'"
            "LIKE" -> "$col LIKE '${escapeSql(filter.value ?: "")}'"
            "IN" -> {
                val vals = (filter.values ?: emptyList()).joinToString(", ") { "'${escapeSql(it)}'" }
                "$col IN ($vals)"
            }
            "IS_NULL" -> "$col IS NULL"
            "IS_NOT_NULL" -> "$col IS NOT NULL"
            else -> "$col = '${escapeSql(filter.value ?: "")}'"
        }
    }

    private fun escapeSql(s: String) = s.replace("'", "''")

    // ═══════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════

    private fun guessFieldRole(colName: String, colType: String): String {
        val typeLower = colType.lowercase()
        val nameLower = colName.lowercase()
        if (nameLower.endsWith("_at") || nameLower.contains("date") || nameLower.contains("time") || typeLower.contains("date") || typeLower.contains("timestamp")) {
            return "TIME_DIMENSION"
        }
        if (nameLower == "id" || nameLower.endsWith("_id") || nameLower.endsWith("_name") || nameLower.endsWith("_code") ||
            nameLower.endsWith("_type") || nameLower == "status" || nameLower == "category" ||
            typeLower.contains("char") || typeLower.contains("text") || typeLower.contains("bool") || typeLower == "uuid") {
            return "DIMENSION"
        }
        if (typeLower.contains("int") || typeLower.contains("float") || typeLower.contains("double") ||
            typeLower.contains("decimal") || typeLower.contains("numeric") || typeLower.contains("real") ||
            typeLower.contains("money")) {
            return "MEASURE"
        }
        return "DIMENSION"
    }

    private fun guessAggregation(colType: String): String {
        return "SUM"
    }

    private fun mapDataType(dbType: String): String {
        val t = dbType.lowercase()
        return when {
            t.contains("int") || t.contains("float") || t.contains("double") || t.contains("decimal") || t.contains("numeric") -> "number"
            t.contains("bool") -> "boolean"
            t.contains("date") && !t.contains("time") -> "date"
            t.contains("timestamp") || t.contains("datetime") -> "timestamp"
            else -> "string"
        }
    }

    private fun humanize(name: String): String =
        name.replace("_", " ").replaceFirstChar { it.uppercase() }

    // ═══════════════════════════════════════════
    //  Mappers
    // ═══════════════════════════════════════════

    private fun DataModel.toListResponse(): DataModelResponse {
        val dsName = dataSourceRepo.findById(datasourceId).map { it.name }.orElse(null)
        val tCount = tableRepo.findByModelIdOrderBySortOrder(id).size
        val fCount = fieldRepo.findByModelId(id).size
        val rCount = relationshipRepo.findByModelId(id).size
        return DataModelResponse(
            id = id, name = name, description = description,
            datasourceId = datasourceId, datasourceName = dsName,
            ownerId = ownerId, isPublished = isPublished,
            tableCount = tCount, fieldCount = fCount, relationshipCount = rCount,
            createdAt = createdAt, updatedAt = updatedAt
        )
    }

    private fun ModelTable.toResponse(fields: List<ModelField>) = ModelTableResponse(
        id = id, modelId = modelId, tableSchema = tableSchema,
        tableName = tableName, alias = alias,
        label = label, description = description,
        isPrimary = isPrimary, sqlExpression = sqlExpression,
        sortOrder = sortOrder,
        fields = fields.map { it.toResponse(alias) },
        createdAt = createdAt
    )

    private fun ModelField.toResponse(tableAlias: String?) = ModelFieldResponse(
        id = id, modelTableId = modelTableId, tableAlias = tableAlias,
        columnName = columnName, fieldRole = fieldRole,
        label = label, description = description,
        dataType = dataType, aggregation = aggregation,
        expression = expression, format = format,
        hidden = hidden, sortOrder = sortOrder,
        createdAt = createdAt
    )

    private fun ModelRelationship.toResponse(leftAlias: String?, rightAlias: String?) = ModelRelationshipResponse(
        id = id, modelId = modelId,
        leftTableId = leftTableId, leftTableAlias = leftAlias, leftColumn = leftColumn,
        rightTableId = rightTableId, rightTableAlias = rightAlias, rightColumn = rightColumn,
        joinType = joinType, label = label, isActive = isActive,
        createdAt = createdAt
    )
}
