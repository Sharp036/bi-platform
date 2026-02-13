package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.service.AuthService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
class HealthController {

    @GetMapping("/health")
    fun health(): Map<String, Any> = mapOf(
        "status" to "UP",
        "service" to "Datorio",
        "version" to "0.1.0",
        "timestamp" to java.time.OffsetDateTime.now().toString()
    )
}

@RestController
@RequestMapping("/auth")
class AuthController(
    private val authService: AuthService
) {
    @PostMapping("/login")
    fun login(@Valid @RequestBody request: LoginRequest): ResponseEntity<TokenResponse> {
        return ResponseEntity.ok(authService.login(request))
    }

    @PostMapping("/register")
    fun register(@Valid @RequestBody request: RegisterRequest): ResponseEntity<UserResponse> {
        return ResponseEntity.ok(authService.register(request))
    }

    @PostMapping("/refresh")
    fun refresh(@Valid @RequestBody request: RefreshTokenRequest): ResponseEntity<TokenResponse> {
        return ResponseEntity.ok(authService.refreshToken(request))
    }

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal userDetails: UserDetails): ResponseEntity<UserResponse> {
        return ResponseEntity.ok(authService.getCurrentUser(userDetails.username))
    }
}
