package com.datorio.config

import com.datorio.model.dto.ApiError
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {
    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(BadCredentialsException::class)
    fun handleBadCredentials(ex: BadCredentialsException): ResponseEntity<ApiError> {
        return error(HttpStatus.UNAUTHORIZED, "Invalid username or password")
    }

    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDenied(ex: AccessDeniedException): ResponseEntity<ApiError> {
        return error(HttpStatus.FORBIDDEN, "Access denied: insufficient permissions")
    }

    @ExceptionHandler(NoSuchElementException::class)
    fun handleNotFound(ex: NoSuchElementException): ResponseEntity<ApiError> {
        return error(HttpStatus.NOT_FOUND, ex.message ?: "Resource not found")
    }

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleBadRequest(ex: IllegalArgumentException): ResponseEntity<ApiError> {
        return error(HttpStatus.BAD_REQUEST, ex.message ?: "Invalid request")
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<ApiError> {
        val messages = ex.bindingResult.fieldErrors.joinToString("; ") {
            "${it.field}: ${it.defaultMessage}"
        }
        return error(HttpStatus.BAD_REQUEST, "Validation failed: $messages")
    }

    @ExceptionHandler(Exception::class)
    fun handleGeneric(ex: Exception): ResponseEntity<ApiError> {
        log.error("Unhandled exception", ex)
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error")
    }

    private fun error(status: HttpStatus, message: String): ResponseEntity<ApiError> {
        return ResponseEntity.status(status).body(
            ApiError(status = status.value(), error = status.reasonPhrase, message = message)
        )
    }
}
