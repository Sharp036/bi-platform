package com.datorio.service

import com.datorio.datasource.ConnectionManager
import com.datorio.datasource.TableInfo
import com.datorio.model.DataSource
import com.datorio.model.dto.*
import com.datorio.repository.DataSourceRepository
import com.datorio.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class DataSourceService(
    private val dataSourceRepository: DataSourceRepository,
    private val userRepository: UserRepository,
    private val connectionManager: ConnectionManager
) {
    fun findAll(): List<DataSourceResponse> {
        return dataSourceRepository.findByIsActiveTrue().map { it.toResponse() }
    }

    fun findById(id: Long): DataSourceResponse {
        return getEntity(id).toResponse()
    }

    @Transactional
    fun create(request: DataSourceCreateRequest, username: String): DataSourceResponse {
        val user = userRepository.findByUsername(username).orElse(null)
        val ds = DataSource(
            name = request.name,
            description = request.description,
            type = request.type,
            host = request.host,
            port = request.port,
            databaseName = request.databaseName,
            username = request.username,
            passwordEnc = request.password,  // TODO: encrypt
            extraParams = request.extraParams,
            createdBy = user
        )
        return dataSourceRepository.save(ds).toResponse()
    }

    @Transactional
    fun update(id: Long, request: DataSourceCreateRequest): DataSourceResponse {
        val ds = getEntity(id)
        ds.name = request.name
        ds.description = request.description
        ds.host = request.host
        ds.port = request.port
        ds.databaseName = request.databaseName
        ds.username = request.username
        if (request.password != null) {
            ds.passwordEnc = request.password  // TODO: encrypt
        }
        ds.extraParams = request.extraParams
        ds.updatedAt = java.time.OffsetDateTime.now()

        connectionManager.evictPool(id)  // force pool recreation
        return dataSourceRepository.save(ds).toResponse()
    }

    @Transactional
    fun delete(id: Long) {
        connectionManager.evictPool(id)
        dataSourceRepository.deleteById(id)
    }

    fun testConnection(id: Long): ConnectionTestResult {
        val ds = getEntity(id)
        return connectionManager.testConnection(ds)
    }

    fun executeQuery(request: QueryExecuteRequest): QueryResult {
        val ds = getEntity(request.datasourceId)
        // Basic SQL injection prevention: block DDL/DML
        val normalizedSql = request.sql.trim().uppercase()
        require(normalizedSql.startsWith("SELECT") || normalizedSql.startsWith("WITH")) {
            "Only SELECT queries are allowed. Use the database admin tools for DDL/DML operations."
        }
        return connectionManager.executeQuery(ds, request.sql, request.limit)
    }

    fun getSchema(id: Long): List<TableInfo> {
        val ds = getEntity(id)
        return connectionManager.getSchemaInfo(ds)
    }

    private fun getEntity(id: Long): DataSource {
        return dataSourceRepository.findById(id)
            .orElseThrow { NoSuchElementException("DataSource not found: $id") }
    }

    private fun DataSource.toResponse() = DataSourceResponse(
        id = id,
        name = name,
        description = description,
        type = type,
        host = host,
        port = port,
        databaseName = databaseName,
        username = username,
        isActive = isActive,
        createdAt = createdAt.toString()
    )
}
