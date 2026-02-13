package com.datorio.model

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "dl_embed_token")
class EmbedToken(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "report_id", nullable = false)
    var reportId: Long,

    @Column(nullable = false, unique = true, length = 128)
    var token: String,

    @Column(length = 300)
    var label: String? = null,

    @Column(columnDefinition = "jsonb")
    var parameters: String = "{}",

    @Column(name = "expires_at")
    var expiresAt: Instant? = null,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(name = "allowed_domains")
    var allowedDomains: String? = null,

    @Column(name = "created_by")
    var createdBy: Long? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)
