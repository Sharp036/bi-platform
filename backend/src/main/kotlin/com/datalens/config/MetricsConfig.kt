package com.datalens.config

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * Custom application metrics exposed via /actuator/prometheus.
 */
@Configuration
class MetricsConfig {

    @Bean
    fun queryExecutionTimer(registry: MeterRegistry): Timer {
        return Timer.builder("datalens.query.execution")
            .description("Query execution time")
            .register(registry)
    }

    @Bean
    fun queryExecutionCounter(registry: MeterRegistry): Counter {
        return Counter.builder("datalens.query.count")
            .description("Total queries executed")
            .register(registry)
    }

    @Bean
    fun queryCacheHitCounter(registry: MeterRegistry): Counter {
        return Counter.builder("datalens.cache.hits")
            .description("Query cache hits")
            .register(registry)
    }

    @Bean
    fun queryCacheMissCounter(registry: MeterRegistry): Counter {
        return Counter.builder("datalens.cache.misses")
            .description("Query cache misses")
            .register(registry)
    }

    @Bean
    fun reportRenderTimer(registry: MeterRegistry): Timer {
        return Timer.builder("datalens.report.render")
            .description("Report render time")
            .register(registry)
    }

    @Bean
    fun alertCheckCounter(registry: MeterRegistry): Counter {
        return Counter.builder("datalens.alert.checks")
            .description("Alert checks performed")
            .register(registry)
    }

    @Bean
    fun alertTriggerCounter(registry: MeterRegistry): Counter {
        return Counter.builder("datalens.alert.triggers")
            .description("Alerts triggered")
            .register(registry)
    }

    @Bean
    fun exportCounter(registry: MeterRegistry): Counter {
        return Counter.builder("datalens.export.count")
            .description("Reports exported")
            .register(registry)
    }
}
