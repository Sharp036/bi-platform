package com.datorio.model

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "api_key")
data class ApiKey(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 255)
    var name: String,

    @Column(name = "key_prefix", nullable = false, length = 16)
    val keyPrefix: String,

    @Column(name = "key_hash", nullable = false, length = 64, unique = true)
    val keyHash: String,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now(),

    @Column(name = "expires_at")
    var expiresAt: OffsetDateTime? = null,

    @Column(name = "last_used_at")
    var lastUsedAt: OffsetDateTime? = null,
) {
    override fun equals(other: Any?): Boolean = other is ApiKey && id == other.id
    override fun hashCode(): Int = id.hashCode()
}
