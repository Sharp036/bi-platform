package com.datorio.model

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "dl_tag")
class Tag(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, unique = true, length = 100)
    var name: String,

    @Column(length = 20)
    var color: String? = null,

    @Column(name = "created_by")
    val createdBy: Long? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

@Entity
@Table(name = "dl_object_tag")
class ObjectTag(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "tag_id", nullable = false)
    val tag: Tag,

    @Column(name = "object_type", nullable = false, length = 50)
    val objectType: String,

    @Column(name = "object_id", nullable = false)
    val objectId: Long,

    @Column(name = "tagged_by")
    val taggedBy: Long? = null,

    @Column(name = "tagged_at", nullable = false, updatable = false)
    val taggedAt: OffsetDateTime = OffsetDateTime.now()
)
