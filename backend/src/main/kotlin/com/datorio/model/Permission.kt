package com.datorio.model

import jakarta.persistence.*

@Entity
@Table(name = "dl_permission")
class Permission(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, unique = true, length = 100)
    val code: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Permission) return false
        return id != 0L && id == other.id
    }

    override fun hashCode(): Int = javaClass.hashCode()

    override fun toString(): String = "Permission(id=$id, code=$code)"
}
