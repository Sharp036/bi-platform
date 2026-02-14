package com.datorio.repository

import com.datorio.model.DataModel
import com.datorio.model.ModelField
import com.datorio.model.ModelRelationship
import com.datorio.model.ModelTable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface DataModelRepository : JpaRepository<DataModel, Long> {
    fun findByOwnerId(ownerId: Long): List<DataModel>
    fun findByDatasourceId(datasourceId: Long): List<DataModel>
    fun findByIsPublishedTrue(): List<DataModel>

    @Query("SELECT m FROM DataModel m WHERE m.ownerId = :userId OR m.isPublished = true")
    fun findAccessibleByUser(userId: Long): List<DataModel>
}

@Repository
interface ModelTableRepository : JpaRepository<ModelTable, Long> {
    fun findByModelIdOrderBySortOrder(modelId: Long): List<ModelTable>
    fun findByModelIdAndIsPrimaryTrue(modelId: Long): ModelTable?
    fun deleteByModelId(modelId: Long)
}

@Repository
interface ModelFieldRepository : JpaRepository<ModelField, Long> {
    fun findByModelTableIdOrderBySortOrder(modelTableId: Long): List<ModelField>
    fun findByModelTableIdIn(tableIds: List<Long>): List<ModelField>

    @Query("SELECT f FROM ModelField f WHERE f.modelTableId IN (SELECT t.id FROM ModelTable t WHERE t.modelId = :modelId) ORDER BY f.sortOrder")
    fun findByModelId(modelId: Long): List<ModelField>

    @Query("SELECT f FROM ModelField f WHERE f.modelTableId IN (SELECT t.id FROM ModelTable t WHERE t.modelId = :modelId) AND f.hidden = false ORDER BY f.sortOrder")
    fun findVisibleByModelId(modelId: Long): List<ModelField>
}

@Repository
interface ModelRelationshipRepository : JpaRepository<ModelRelationship, Long> {
    fun findByModelIdAndIsActiveTrue(modelId: Long): List<ModelRelationship>
    fun findByModelId(modelId: Long): List<ModelRelationship>
    fun deleteByModelId(modelId: Long)
}
