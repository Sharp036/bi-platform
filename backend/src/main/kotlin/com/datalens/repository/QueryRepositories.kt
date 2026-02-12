package com.datalens.repository

import com.datalens.model.*
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.OffsetDateTime

@Repository
interface SavedQueryRepository : JpaRepository<SavedQuery, Long> {

    fun findByDatasourceId(datasourceId: Long): List<SavedQuery>

    fun findByCreatedById(userId: Long): List<SavedQuery>

    fun findByFolderId(folderId: Long?): List<SavedQuery>

    fun findByIsFavoriteTrue(): List<SavedQuery>

    @Query("SELECT q FROM SavedQuery q WHERE LOWER(q.name) LIKE LOWER(CONCAT('%', :term, '%'))")
    fun search(@Param("term") term: String): List<SavedQuery>

    @Query("""
        SELECT q FROM SavedQuery q 
        WHERE (:datasourceId IS NULL OR q.datasource.id = :datasourceId)
        AND (:folderId IS NULL OR q.folder.id = :folderId)
        ORDER BY q.updatedAt DESC
    """)
    fun findFiltered(
        @Param("datasourceId") datasourceId: Long?,
        @Param("folderId") folderId: Long?,
        pageable: Pageable
    ): Page<SavedQuery>
}

@Repository
interface QueryVersionRepository : JpaRepository<QueryVersion, Long> {

    fun findByQueryIdOrderByVersionNumberDesc(queryId: Long): List<QueryVersion>

    @Query("SELECT MAX(v.versionNumber) FROM QueryVersion v WHERE v.query.id = :queryId")
    fun findMaxVersionNumber(@Param("queryId") queryId: Long): Int?
}

@Repository
interface SchemaCacheRepository : JpaRepository<SchemaCache, Long> {

    fun findByDatasourceId(datasourceId: Long): List<SchemaCache>

    fun findByDatasourceIdAndSchemaNameAndTableName(
        datasourceId: Long, schemaName: String?, tableName: String
    ): SchemaCache?

    fun deleteByDatasourceId(datasourceId: Long)

    @Query("SELECT s FROM SchemaCache s WHERE s.datasource.id = :dsId AND s.cachedAt > :since")
    fun findFreshCache(
        @Param("dsId") datasourceId: Long,
        @Param("since") since: OffsetDateTime
    ): List<SchemaCache>
}

@Repository
interface QueryExecutionRepository : JpaRepository<QueryExecution, Long> {

    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: Pageable): Page<QueryExecution>

    fun findByDatasourceIdOrderByCreatedAtDesc(datasourceId: Long, pageable: Pageable): Page<QueryExecution>

    @Query("""
        SELECT e FROM QueryExecution e
        WHERE (:userId IS NULL OR e.user.id = :userId)
        AND (:dsId IS NULL OR e.datasource.id = :dsId)
        AND (:status IS NULL OR e.status = :status)
        AND (:from IS NULL OR e.createdAt >= :from)
        AND (:to IS NULL OR e.createdAt <= :to)
        ORDER BY e.createdAt DESC
    """)
    fun findFiltered(
        @Param("userId") userId: Long?,
        @Param("dsId") datasourceId: Long?,
        @Param("status") status: ExecutionStatus?,
        @Param("from") from: OffsetDateTime?,
        @Param("to") to: OffsetDateTime?,
        pageable: Pageable
    ): Page<QueryExecution>

    @Query("""
        SELECT e.datasource.id, COUNT(e), AVG(e.executionMs) 
        FROM QueryExecution e 
        WHERE e.status = 'SUCCESS' AND e.createdAt > :since
        GROUP BY e.datasource.id
    """)
    fun getExecutionStats(@Param("since") since: OffsetDateTime): List<Array<Any>>
}

@Repository
interface QueryFolderRepository : JpaRepository<QueryFolder, Long> {

    fun findByParentId(parentId: Long?): List<QueryFolder>

    fun findByParentIsNull(): List<QueryFolder>
}
