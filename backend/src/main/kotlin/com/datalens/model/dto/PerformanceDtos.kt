package com.datalens.model.dto

data class CacheStatsDto(
    val hitCount: Long,
    val missCount: Long,
    val hitRate: Double,
    val evictionCount: Long,
    val entryCount: Long,
    val estimatedSizeBytes: Long,
    val enabled: Boolean
)

data class PoolStatsDto(
    val datasourceId: Long,
    val datasourceName: String,
    val activeConnections: Int,
    val idleConnections: Int,
    val totalConnections: Int,
    val maxPoolSize: Int,
    val waitingThreads: Int
)

data class SystemHealthDto(
    val cache: CacheStatsDto,
    val connectionPools: List<PoolStatsDto>,
    val jvmHeapUsedMb: Long,
    val jvmHeapMaxMb: Long,
    val uptime: String
)

data class ExplainRequest(
    val datasourceId: Long,
    val sql: String
)

data class ExplainResponse(
    val plan: List<String>,
    val estimatedCost: Double?,
    val estimatedRows: Long?,
    val warnings: List<String>,
    val suggestions: List<String>
)

data class QuickAnalysisRequest(
    val sql: String
)
