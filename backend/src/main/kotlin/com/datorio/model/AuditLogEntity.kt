package com.datorio.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.OffsetDateTime

@Entity
@Table(name = "dl_audit_log")
class AuditLog(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id")
    var userId: Long? = null,

    @Column(nullable = false, length = 100)
    var action: String,

    @Column(name = "object_type", length = 50)
    var objectType: String? = null,

    @Column(name = "object_id")
    var objectId: Long? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    var details: Map<String, Any?> = emptyMap(),

    @Column(name = "ip_address", length = 45)
    var ipAddress: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)
