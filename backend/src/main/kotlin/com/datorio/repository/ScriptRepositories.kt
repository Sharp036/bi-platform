package com.datorio.repository

import com.datorio.model.Script
import com.datorio.model.ScriptExecution
import com.datorio.model.ScriptType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface ScriptRepository : JpaRepository<Script, Long> {

    fun findByIsActiveTrue(pageable: Pageable): Page<Script>

    fun findByScriptTypeAndIsActiveTrue(scriptType: ScriptType, pageable: Pageable): Page<Script>

    fun findByIsLibraryTrueAndIsActiveTrue(): List<Script>

    @Query("SELECT s FROM Script s WHERE s.isActive = true AND " +
           "(LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%')))")
    fun search(search: String, pageable: Pageable): Page<Script>

    @Query("SELECT s FROM Script s WHERE s.isActive = true AND s.scriptType = :type AND " +
           "(LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(s.description) LIKE LOWER(CONCAT('%', :search, '%')))")
    fun searchByType(search: String, type: ScriptType, pageable: Pageable): Page<Script>
}

interface ScriptExecutionRepository : JpaRepository<ScriptExecution, Long> {

    fun findByScriptIdOrderByCreatedAtDesc(scriptId: Long, pageable: Pageable): Page<ScriptExecution>

    @Query("SELECT se FROM ScriptExecution se ORDER BY se.createdAt DESC")
    fun findRecent(pageable: Pageable): Page<ScriptExecution>
}
