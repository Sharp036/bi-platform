package com.datalens.controller

import com.datalens.datasource.TableInfo
import com.datalens.model.dto.*
import com.datalens.service.DataSourceService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/datasources")
class DataSourceController(
    private val dataSourceService: DataSourceService
) {
    @GetMapping
    @PreAuthorize("hasAuthority('DATASOURCE_VIEW')")
    fun list(): ResponseEntity<List<DataSourceResponse>> {
        return ResponseEntity.ok(dataSourceService.findAll())
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('DATASOURCE_VIEW')")
    fun get(@PathVariable id: Long): ResponseEntity<DataSourceResponse> {
        return ResponseEntity.ok(dataSourceService.findById(id))
    }

    @PostMapping
    @PreAuthorize("hasAuthority('DATASOURCE_CREATE')")
    fun create(
        @Valid @RequestBody request: DataSourceCreateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<DataSourceResponse> {
        return ResponseEntity.ok(dataSourceService.create(request, user.username))
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('DATASOURCE_EDIT')")
    fun update(
        @PathVariable id: Long,
        @Valid @RequestBody request: DataSourceCreateRequest
    ): ResponseEntity<DataSourceResponse> {
        return ResponseEntity.ok(dataSourceService.update(id, request))
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('DATASOURCE_DELETE')")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        dataSourceService.delete(id)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/{id}/test")
    @PreAuthorize("hasAuthority('DATASOURCE_VIEW')")
    fun testConnection(@PathVariable id: Long): ResponseEntity<ConnectionTestResult> {
        return ResponseEntity.ok(dataSourceService.testConnection(id))
    }

    @GetMapping("/{id}/schema")
    @PreAuthorize("hasAuthority('DATASOURCE_VIEW')")
    fun getSchema(@PathVariable id: Long): ResponseEntity<List<TableInfo>> {
        return ResponseEntity.ok(dataSourceService.getSchema(id))
    }
}

@RestController
@RequestMapping("/query")
class QueryController(
    private val dataSourceService: DataSourceService
) {
    @PostMapping("/execute")
    @PreAuthorize("hasAuthority('QUERY_EXECUTE')")
    fun execute(@Valid @RequestBody request: QueryExecuteRequest): ResponseEntity<QueryResult> {
        return ResponseEntity.ok(dataSourceService.executeQuery(request))
    }
}
