package com.datalens.service

import com.datalens.model.dto.QueryResult
import com.github.benmanes.caffeine.cache.Caffeine
import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.stats.CacheStats
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import jakarta.annotation.PostConstruct

data class CacheKey(
    val datasourceId: Long,
    val sqlHash: String,
    val paramsHash: String
)

data class CachedResult(
    val result: QueryResult,
    val cachedAt: Long = System.currentTimeMillis(),
    val sizeBytes: Long = 0
)

data class CacheStatsResponse(
    val hitCount: Long,
    val missCount: Long,
    val hitRate: Double,
    val evictionCount: Long,
    val entryCount: Long,
    val estimatedSizeBytes: Long
)

@Service
class QueryCacheService {
    private val log = LoggerFactory.getLogger(javaClass)

    @Value("\${datalens.cache.query-ttl-seconds:300}")
    private var ttlSeconds: Long = 300

    @Value("\${datalens.cache.query-max-size:500}")
    private var maxSize: Long = 500

    @Value("\${datalens.cache.enabled:true}")
    private var cacheEnabled: Boolean = true

    private lateinit var cache: Cache<CacheKey, CachedResult>

    @PostConstruct
    fun init() {
        cache = Caffeine.newBuilder()
            .maximumSize(maxSize)
            .expireAfterWrite(ttlSeconds, TimeUnit.SECONDS)
            .recordStats()
            .build()
        log.info("Query cache initialized: maxSize={}, ttl={}s", maxSize, ttlSeconds)
    }

    /**
     * Try to get a cached result. Returns null on miss.
     */
    fun get(datasourceId: Long, sql: String, params: Map<String, Any?>): QueryResult? {
        if (!cacheEnabled) return null
        val key = buildKey(datasourceId, sql, params)
        val cached = cache.getIfPresent(key)
        if (cached != null) {
            log.debug("Cache HIT: ds={}, sqlHash={}", datasourceId, key.sqlHash.take(8))
            return cached.result
        }
        log.debug("Cache MISS: ds={}, sqlHash={}", datasourceId, key.sqlHash.take(8))
        return null
    }

    /**
     * Cache a query result.
     */
    fun put(datasourceId: Long, sql: String, params: Map<String, Any?>, result: QueryResult) {
        if (!cacheEnabled) return
        val key = buildKey(datasourceId, sql, params)
        val sizeEstimate = estimateSize(result)
        cache.put(key, CachedResult(result, sizeBytes = sizeEstimate))
        log.debug("Cache PUT: ds={}, sqlHash={}, rows={}, ~{}KB",
            datasourceId, key.sqlHash.take(8), result.rowCount, sizeEstimate / 1024)
    }

    /**
     * Invalidate all cached results for a specific datasource.
     */
    fun invalidateByDatasource(datasourceId: Long) {
        val keys = cache.asMap().keys.filter { it.datasourceId == datasourceId }
        cache.invalidateAll(keys)
        log.info("Invalidated {} cache entries for datasource {}", keys.size, datasourceId)
    }

    /**
     * Invalidate a specific query.
     */
    fun invalidateQuery(datasourceId: Long, sql: String) {
        val sqlHash = hash(sql.trim().lowercase())
        val keys = cache.asMap().keys.filter {
            it.datasourceId == datasourceId && it.sqlHash == sqlHash
        }
        cache.invalidateAll(keys)
    }

    /**
     * Invalidate everything.
     */
    fun invalidateAll() {
        val count = cache.estimatedSize()
        cache.invalidateAll()
        log.info("Invalidated all {} cache entries", count)
    }

    /**
     * Get cache statistics.
     */
    fun getStats(): CacheStatsResponse {
        val stats: CacheStats = cache.stats()
        return CacheStatsResponse(
            hitCount = stats.hitCount(),
            missCount = stats.missCount(),
            hitRate = if (stats.requestCount() > 0) stats.hitRate() else 0.0,
            evictionCount = stats.evictionCount(),
            entryCount = cache.estimatedSize(),
            estimatedSizeBytes = cache.asMap().values.sumOf { it.sizeBytes }
        )
    }

    fun isEnabled() = cacheEnabled

    fun setEnabled(enabled: Boolean) {
        cacheEnabled = enabled
        if (!enabled) invalidateAll()
        log.info("Query cache {}", if (enabled) "enabled" else "disabled")
    }

    // ── Internal ──

    private fun buildKey(datasourceId: Long, sql: String, params: Map<String, Any?>): CacheKey {
        return CacheKey(
            datasourceId = datasourceId,
            sqlHash = hash(sql.trim().lowercase()),
            paramsHash = hash(params.entries.sortedBy { it.key }.joinToString(",") { "${it.key}=${it.value}" })
        )
    }

    private fun hash(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    private fun estimateSize(result: QueryResult): Long {
        // Rough estimate: column names + row data
        var size = result.columns.sumOf { it.name.length * 2L }
        for (row in result.rows) {
            size += (row as? List<*>)?.sumOf { (it?.toString()?.length ?: 0) * 2L + 16 } ?: 200L
        }
        return size
    }
}
