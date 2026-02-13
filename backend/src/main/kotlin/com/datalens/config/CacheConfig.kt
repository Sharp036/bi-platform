package com.datalens.config

import com.github.benmanes.caffeine.cache.Caffeine
import org.springframework.beans.factory.annotation.Value
import org.springframework.cache.CacheManager
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.caffeine.CaffeineCacheManager
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.util.concurrent.TimeUnit

@Configuration
@EnableCaching
class CacheConfig {

    @Value("\${datalens.cache.query-ttl-seconds:300}")
    private var queryTtlSeconds: Long = 300

    @Value("\${datalens.cache.query-max-size:500}")
    private var queryMaxSize: Long = 500

    @Value("\${datalens.cache.schema-ttl-seconds:600}")
    private var schemaTtlSeconds: Long = 600

    @Bean
    fun cacheManager(): CacheManager {
        val manager = CaffeineCacheManager()
        manager.setCaffeine(
            Caffeine.newBuilder()
                .maximumSize(queryMaxSize)
                .expireAfterWrite(queryTtlSeconds, TimeUnit.SECONDS)
                .recordStats()
        )
        // Register named caches with different configs
        manager.setCacheNames(listOf("queryResults", "schemaInfo", "reportRender"))
        return manager
    }

    /**
     * Separate cache for schema info (longer TTL).
     */
    @Bean("schemaCacheManager")
    fun schemaCacheManager(): CacheManager {
        val manager = CaffeineCacheManager()
        manager.setCaffeine(
            Caffeine.newBuilder()
                .maximumSize(100)
                .expireAfterWrite(schemaTtlSeconds, TimeUnit.SECONDS)
                .recordStats()
        )
        manager.setCacheNames(listOf("schemaInfo"))
        return manager
    }
}
