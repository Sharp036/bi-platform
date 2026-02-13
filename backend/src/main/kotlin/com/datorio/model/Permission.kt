package com.datorio.model

import jakarta.persistence.*

@Entity
@Table(name = "dl_permission")
data class Permission(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, unique = true, length = 100)
    val code: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null
)
