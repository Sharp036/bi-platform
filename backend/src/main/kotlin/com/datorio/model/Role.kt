package com.datorio.model

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "dl_role")
data class Role(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, unique = true, length = 100)
    val name: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @Column(name = "is_system", nullable = false)
    val isSystem: Boolean = false,

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "dl_role_permission",
        joinColumns = [JoinColumn(name = "role_id")],
        inverseJoinColumns = [JoinColumn(name = "permission_id")]
    )
    val permissions: MutableSet<Permission> = mutableSetOf(),

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)
