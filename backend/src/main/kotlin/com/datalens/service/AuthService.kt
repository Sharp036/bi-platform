package com.datalens.service

import com.datalens.model.User
import com.datalens.model.dto.*
import com.datalens.repository.RoleRepository
import com.datalens.repository.UserRepository
import com.datalens.security.JwtTokenProvider
import org.slf4j.LoggerFactory
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val roleRepository: RoleRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtTokenProvider: JwtTokenProvider,
    private val authenticationManager: AuthenticationManager
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun login(request: LoginRequest): TokenResponse {
        val authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken(request.username, request.password)
        )
        SecurityContextHolder.getContext().authentication = authentication

        val user = userRepository.findByUsername(request.username)
            .orElseThrow { IllegalArgumentException("User not found") }

        val roles = user.roles.map { it.name }
        val accessToken = jwtTokenProvider.generateAccessToken(user.username, roles)
        val refreshToken = jwtTokenProvider.generateRefreshToken(user.username)

        log.info("User '${user.username}' logged in successfully")

        return TokenResponse(
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresIn = jwtTokenProvider.getAccessTokenExpirationMs() / 1000
        )
    }

    @Transactional
    fun register(request: RegisterRequest): UserResponse {
        require(!userRepository.existsByUsername(request.username)) {
            "Username '${request.username}' already exists"
        }
        require(!userRepository.existsByEmail(request.email)) {
            "Email '${request.email}' already registered"
        }

        val viewerRole = roleRepository.findByName("VIEWER")
            .orElseThrow { IllegalStateException("Default VIEWER role not found") }

        val user = User(
            username = request.username,
            email = request.email,
            passwordHash = passwordEncoder.encode(request.password),
            displayName = request.displayName
        )
        user.roles.add(viewerRole)

        val saved = userRepository.save(user)
        log.info("New user registered: '${saved.username}'")
        return saved.toResponse()
    }

    fun refreshToken(request: RefreshTokenRequest): TokenResponse {
        require(jwtTokenProvider.validateToken(request.refreshToken)) {
            "Invalid refresh token"
        }
        val username = jwtTokenProvider.getUsernameFromToken(request.refreshToken)
        val user = userRepository.findByUsername(username)
            .orElseThrow { IllegalArgumentException("User not found") }

        val roles = user.roles.map { it.name }
        return TokenResponse(
            accessToken = jwtTokenProvider.generateAccessToken(username, roles),
            refreshToken = jwtTokenProvider.generateRefreshToken(username),
            expiresIn = jwtTokenProvider.getAccessTokenExpirationMs() / 1000
        )
    }

    fun getCurrentUser(username: String): UserResponse {
        val user = userRepository.findByUsername(username)
            .orElseThrow { IllegalArgumentException("User not found: $username") }
        return user.toResponse()
    }

    private fun User.toResponse() = UserResponse(
        id = id,
        username = username,
        email = email,
        displayName = displayName,
        roles = roles.map { it.name },
        permissions = roles.flatMap { r -> r.permissions.map { it.code } }.distinct()
    )
}
