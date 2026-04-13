package com.datorio.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.MDC
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.util.UUID

/**
 * Assigns a unique requestId to every HTTP request via SLF4J MDC.
 * The requestId is included in all log lines (via logback pattern)
 * and returned in the X-Request-Id response header so the frontend
 * can correlate errors with backend logs.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RequestIdFilter : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val requestId = request.getHeader("X-Request-Id")
            ?: UUID.randomUUID().toString().substring(0, 8)
        MDC.put("requestId", requestId)
        MDC.put("method", request.method)
        MDC.put("uri", request.requestURI)
        response.setHeader("X-Request-Id", requestId)
        try {
            filterChain.doFilter(request, response)
        } finally {
            MDC.clear()
        }
    }
}
