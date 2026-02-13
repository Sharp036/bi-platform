package com.datorio.controller

import com.datorio.datasource.ConnectionManager
import com.datorio.model.dto.*
import com.datorio.repository.DataSourceRepository
import com.datorio.service.QueryCacheService
import com.datorio.service.QueryOptimizationService
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*
import java.lang.management.ManagementFactory

@RestController
@RequestMapping("/performance")
class PerformanceController(
    private val cacheService: QueryCacheService,
    private val optimizationService: QueryOptimizationService,
    private val connectionManager: ConnectionManager,
    private val dataSourceRepository: DataSourceRepository
) {

    // ── Cache Management ──

    @GetMapping("/cache/stats")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getCacheStats(): CacheStatsDto {
        val stats = cacheService.getStats()
        return CacheStatsDto(
            hitCount = stats.hitCount,
            missCount = stats.missCount,
            hitRate = stats.hitRate,
            evictionCount = stats.evictionCount,
            entryCount = stats.entryCount,
            estimatedSizeBytes = stats.estimatedSizeBytes,
            enabled = cacheService.isEnabled()
        )
    }

    @PostMapping("/cache/invalidate")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun invalidateCache(): ResponseEntity<Map<String, String>> {
        cacheService.invalidateAll()
        return ResponseEntity.ok(mapOf("message" to "Cache cleared"))
    }

    @PostMapping("/cache/invalidate/datasource/{id}")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun invalidateDatasourceCache(@PathVariable id: Long): ResponseEntity<Map<String, String>> {
        cacheService.invalidateByDatasource(id)
        return ResponseEntity.ok(mapOf("message" to "Cache cleared for datasource $id"))
    }

    @PostMapping("/cache/toggle")
    @PreAuthorize("hasAuthority('REPORT_EDIT')")
    fun toggleCache(@RequestParam enabled: Boolean): ResponseEntity<Map<String, Any>> {
        cacheService.setEnabled(enabled)
        return ResponseEntity.ok(mapOf("enabled" to enabled, "message" to "Cache ${if (enabled) "enabled" else "disabled"}"))
    }

    // ── Connection Pool Stats ──

    @GetMapping("/pools")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getPoolStats(): List<PoolStatsDto> {
        val datasources = dataSourceRepository.findAll()
        return datasources.mapNotNull { ds ->
            try {
                val pool = connectionManager.getPool(ds)
                val hikariPool = pool.hikariPoolMXBean ?: return@mapNotNull null
                PoolStatsDto(
                    datasourceId = ds.id,
                    datasourceName = ds.name,
                    activeConnections = hikariPool.activeConnections,
                    idleConnections = hikariPool.idleConnections,
                    totalConnections = hikariPool.totalConnections,
                    maxPoolSize = pool.maximumPoolSize,
                    waitingThreads = hikariPool.threadsAwaitingConnection
                )
            } catch (_: Exception) { null }
        }
    }

    // ── System Health ──

    @GetMapping("/health")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun getSystemHealth(): SystemHealthDto {
        val cacheStats = cacheService.getStats()
        val pools = try {
            val datasources = dataSourceRepository.findAll()
            datasources.mapNotNull { ds ->
                try {
                    val pool = connectionManager.getPool(ds)
                    val hp = pool.hikariPoolMXBean ?: return@mapNotNull null
                    PoolStatsDto(ds.id, ds.name, hp.activeConnections, hp.idleConnections,
                        hp.totalConnections, pool.maximumPoolSize, hp.threadsAwaitingConnection)
                } catch (_: Exception) { null }
            }
        } catch (_: Exception) { emptyList() }

        val runtime = Runtime.getRuntime()
        val uptime = ManagementFactory.getRuntimeMXBean().uptime
        val hours = uptime / 3600000
        val minutes = (uptime % 3600000) / 60000

        return SystemHealthDto(
            cache = CacheStatsDto(
                cacheStats.hitCount, cacheStats.missCount, cacheStats.hitRate,
                cacheStats.evictionCount, cacheStats.entryCount, cacheStats.estimatedSizeBytes,
                cacheService.isEnabled()
            ),
            connectionPools = pools,
            jvmHeapUsedMb = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024),
            jvmHeapMaxMb = runtime.maxMemory() / (1024 * 1024),
            uptime = "${hours}h ${minutes}m"
        )
    }

    // ── Query Optimization ──

    @PostMapping("/explain")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun explain(@RequestBody request: ExplainRequest): ExplainResponse {
        val plan = optimizationService.explain(request.datasourceId, request.sql)
        return ExplainResponse(
            plan = plan.planLines,
            estimatedCost = plan.estimatedCost,
            estimatedRows = plan.estimatedRows,
            warnings = plan.warnings,
            suggestions = plan.suggestions
        )
    }

    @PostMapping("/analyze")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    fun quickAnalyze(@RequestBody request: QuickAnalysisRequest): List<String> {
        return optimizationService.quickAnalysis(request.sql)
    }
}
