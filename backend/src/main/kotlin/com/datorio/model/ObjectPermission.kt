package com.datorio.model

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "dl_object_permission")
class ObjectPermission(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "object_type", nullable = false, length = 50)
    val objectType: String,

    @Column(name = "object_id", nullable = false)
    val objectId: Long,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id")
    var role: Role? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    var user: User? = null,

    @Column(name = "access_level", nullable = false, length = 20)
    var accessLevel: String = "VIEW",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

enum class ObjectType {
    DATASOURCE, REPORT, DASHBOARD
}

enum class AccessLevel {
    VIEW, EDIT, ADMIN
}
