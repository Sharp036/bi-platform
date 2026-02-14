package com.datorio.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

/**
 * Configure async support for SSE (Server-Sent Events).
 * SseEmitter requires async request processing.
 */
@Configuration
class AsyncConfig : WebMvcConfigurer {

    override fun configureAsyncSupport(configurer: AsyncSupportConfigurer) {
        configurer.setDefaultTimeout(30 * 60 * 1000L) // 30 min
        configurer.setTaskExecutor(sseTaskExecutor())
    }

    @Bean
    fun sseTaskExecutor(): ThreadPoolTaskExecutor {
        val executor = ThreadPoolTaskExecutor()
        executor.corePoolSize = 5
        executor.maxPoolSize = 20
        executor.setThreadNamePrefix("sse-")
        executor.initialize()
        return executor
    }
}
