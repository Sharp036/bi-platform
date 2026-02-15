package com.datorio.model

import jakarta.persistence.*
import java.time.Instant

// ─────────────────────────────────────────────
//  Script Types
// ─────────────────────────────────────────────

enum class ScriptType { TRANSFORM, FORMAT, EVENT, LIBRARY }
enum class ScriptExecStatus { SUCCESS, ERROR, TIMEOUT }

// ─────────────────────────────────────────────
//  Script
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_script")
class Script(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 300)
    var name: String,

    var description: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "script_type", nullable = false, length = 30)
    var scriptType: ScriptType = ScriptType.TRANSFORM,

    @Column(nullable = false, columnDefinition = "TEXT")
    var code: String,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(name = "is_library", nullable = false)
    var isLibrary: Boolean = false,

    @Column(columnDefinition = "jsonb")
    var tags: String = "[]",

    @Column(columnDefinition = "jsonb")
    var config: String = "{}",

    @Column(name = "created_by")
    var createdBy: Long? = null,

    @Column(name = "updated_by")
    var updatedBy: Long? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
)

// ─────────────────────────────────────────────
//  Script Execution Log
// ─────────────────────────────────────────────

@Entity
@Table(name = "dl_script_execution")
class ScriptExecution(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "script_id")
    var scriptId: Long? = null,

    @Column(name = "script_name", length = 300)
    var scriptName: String? = null,

    @Column(name = "context_type", length = 30)
    var contextType: String? = null,

    @Column(name = "context_id")
    var contextId: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: ScriptExecStatus = ScriptExecStatus.SUCCESS,

    @Column(name = "execution_ms")
    var executionMs: Long? = null,

    @Column(name = "input_rows")
    var inputRows: Int? = null,

    @Column(name = "output_rows")
    var outputRows: Int? = null,

    @Column(name = "error_message")
    var errorMessage: String? = null,

    @Column(name = "executed_by", length = 100)
    var executedBy: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)
