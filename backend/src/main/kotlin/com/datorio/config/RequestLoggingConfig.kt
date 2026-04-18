package com.datorio.config

import jakarta.servlet.http.HttpServletRequest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.CommonsRequestLoggingFilter

@Configuration
class RequestLoggingConfig {

    companion object {
        /** Roles for which detailed request logging is enabled.
         *  Requests from users without any of these roles are not logged.
         *  Edit this set to add/remove debug roles. */
        val DEBUG_ROLES = setOf("ROLE_ADMIN")
    }

    @Bean
    fun requestLoggingFilter(): CommonsRequestLoggingFilter {
        val f = object : CommonsRequestLoggingFilter() {
            override fun shouldLog(request: HttpServletRequest): Boolean {
                val auth = SecurityContextHolder.getContext().authentication ?: return false
                return auth.authorities.any { it.authority in DEBUG_ROLES }
            }
        }
        f.setIncludeClientInfo(true)
        f.setIncludeQueryString(true)
        f.setIncludePayload(true)
        f.setMaxPayloadLength(10_000)
        f.setIncludeHeaders(false)
        return f
    }
}