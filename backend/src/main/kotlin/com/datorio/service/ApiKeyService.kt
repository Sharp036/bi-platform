package com.datorio.service

import com.datorio.model.ApiKey
import com.datorio.model.dto.ApiKeyCreateRequest
import com.datorio.model.dto.ApiKeyCreatedResponse
import com.datorio.model.dto.ApiKeyResponse
import com.datorio.repository.ApiKeyRepository
import com.datorio.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.util.Base64
import java.util.Optional

@Service
class ApiKeyService(
    private val apiKeyRepo: ApiKeyRepository,
    private val userRepo: UserRepository,
) {
    private val rng = SecureRandom()

    // ── Public API ────────────────────────────────────────────────────────────

    @Transactional
    fun create(req: ApiKeyCreateRequest, username: String): ApiKeyCreatedResponse {
        val user = userRepo.findByUsername(username)
            .orElseThrow { NoSuchElementException("User not found") }

        val rawKey = generateKey()
        val hash = sha256hex(rawKey)
        val prefix = rawKey.take(12)

        val expiresAt = req.expiresAt?.let { OffsetDateTime.parse(it) }

        val entity = apiKeyRepo.save(ApiKey(
            name = req.name,
            keyPrefix = prefix,
            keyHash = hash,
            user = user,
            expiresAt = expiresAt,
        ))

        return ApiKeyCreatedResponse(
            id = entity.id,
            name = entity.name,
            keyPrefix = prefix,
            key = rawKey,
            createdAt = entity.createdAt.toString(),
            expiresAt = entity.expiresAt?.toString(),
        )
    }

    @Transactional(readOnly = true)
    fun list(username: String): List<ApiKeyResponse> {
        val user = userRepo.findByUsername(username)
            .orElseThrow { NoSuchElementException("User not found") }
        return apiKeyRepo.findAllByUserId(user.id).map { it.toResponse() }
    }

    @Transactional
    fun revoke(id: Long, username: String) {
        val key = apiKeyRepo.findById(id)
            .orElseThrow { NoSuchElementException("API key not found") }
        val user = userRepo.findByUsername(username)
            .orElseThrow { NoSuchElementException("User not found") }
        if (key.user.id != user.id) throw IllegalArgumentException("Not your key")
        apiKeyRepo.delete(key)
    }

    // ── Used by the auth filter ───────────────────────────────────────────────

    @Transactional
    fun authenticateByRawKey(rawKey: String): Optional<ApiKey> {
        val hash = sha256hex(rawKey)
        val keyOpt = apiKeyRepo.findByKeyHash(hash)
        if (keyOpt.isEmpty) return Optional.empty()
        val key = keyOpt.get()
        if (key.expiresAt != null && key.expiresAt!!.isBefore(OffsetDateTime.now())) {
            return Optional.empty()
        }
        key.lastUsedAt = OffsetDateTime.now()
        apiKeyRepo.save(key)
        return Optional.of(key)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun generateKey(): String {
        val bytes = ByteArray(32)
        rng.nextBytes(bytes)
        return "dat_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun sha256hex(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(input.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    private fun ApiKey.toResponse() = ApiKeyResponse(
        id = id,
        name = name,
        keyPrefix = keyPrefix,
        createdAt = createdAt.toString(),
        expiresAt = expiresAt?.toString(),
        lastUsedAt = lastUsedAt?.toString(),
    )
}
