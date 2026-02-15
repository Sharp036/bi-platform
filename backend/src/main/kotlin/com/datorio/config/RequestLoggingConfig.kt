package com.datorio.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.filter.CommonsRequestLoggingFilter

@Configuration
class RequestLoggingConfig {
    @Bean
    fun requestLoggingFilter(): CommonsRequestLoggingFilter {
        val f = CommonsRequestLoggingFilter()
        f.setIncludeClientInfo(true)
        f.setIncludeQueryString(true)
        f.setIncludePayload(true)
        f.setMaxPayloadLength(10_000)
        f.setIncludeHeaders(false)
        return f
    }
}