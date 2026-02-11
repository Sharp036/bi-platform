package com.datalens.security

import io.jsonwebtoken.*
import io.jsonwebtoken.security.Keys
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.*
import javax.crypto.SecretKey

@Component
class JwtTokenProvider(
    @Value("\${datalens.jwt.secret}") private val jwtSecret: String,
    @Value("\${datalens.jwt.access-token-expiration}") private val accessExpiration: Long,
    @Value("\${datalens.jwt.refresh-token-expiration}") private val refreshExpiration: Long
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private val key: SecretKey by lazy {
        Keys.hmacShaKeyFor(jwtSecret.toByteArray())
    }

    fun generateAccessToken(username: String, roles: List<String>): String {
        return buildToken(username, roles, accessExpiration)
    }

    fun generateRefreshToken(username: String): String {
        return buildToken(username, emptyList(), refreshExpiration)
    }

    fun getAccessTokenExpirationMs(): Long = accessExpiration

    fun getUsernameFromToken(token: String): String {
        return parseToken(token).payload.subject
    }

    fun validateToken(token: String): Boolean {
        return try {
            parseToken(token)
            true
        } catch (ex: JwtException) {
            log.warn("Invalid JWT token: ${ex.message}")
            false
        } catch (ex: IllegalArgumentException) {
            log.warn("JWT token is empty: ${ex.message}")
            false
        }
    }

    private fun buildToken(username: String, roles: List<String>, expirationMs: Long): String {
        val now = Date()
        val expiry = Date(now.time + expirationMs)
        return Jwts.builder()
            .subject(username)
            .claim("roles", roles)
            .issuedAt(now)
            .expiration(expiry)
            .signWith(key)
            .compact()
    }

    private fun parseToken(token: String): Jws<Claims> {
        return Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
    }
}
