package com.datorio.repository

import com.datorio.model.ObjectTag
import com.datorio.model.Tag
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface TagRepository : JpaRepository<Tag, Long> {
    fun findByNameIgnoreCase(name: String): Tag?
    fun findByNameContainingIgnoreCase(name: String): List<Tag>

    @Query("SELECT t FROM Tag t ORDER BY t.name")
    fun findAllOrdered(): List<Tag>
}

@Repository
interface ObjectTagRepository : JpaRepository<ObjectTag, Long> {
    fun findByObjectTypeAndObjectId(objectType: String, objectId: Long): List<ObjectTag>
    fun findByTagId(tagId: Long): List<ObjectTag>
    fun findByTagIdAndObjectType(tagId: Long, objectType: String): List<ObjectTag>
    fun findByObjectTypeAndObjectIdAndTagId(objectType: String, objectId: Long, tagId: Long): ObjectTag?
    fun deleteByObjectTypeAndObjectIdAndTagId(objectType: String, objectId: Long, tagId: Long)
    fun deleteByObjectTypeAndObjectId(objectType: String, objectId: Long)

    @Query("SELECT ot.tag.id, COUNT(ot) FROM ObjectTag ot GROUP BY ot.tag.id")
    fun countByTag(): List<Array<Any>>
}
