package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset

@Service
class TagService(
    private val tagRepo: TagRepository,
    private val objectTagRepo: ObjectTagRepository
) {

    // ─── Tag CRUD ───

    fun listTags(): List<TagDto> {
        val tags = tagRepo.findAllOrdered()
        val counts = objectTagRepo.countByTag()
            .associate { (it[0] as Long) to (it[1] as Long).toInt() }
        return tags.map { it.toDto(counts[it.id] ?: 0) }
    }

    fun searchTags(query: String): List<TagDto> {
        return tagRepo.findByNameContainingIgnoreCase(query).map { it.toDto(0) }
    }

    @Transactional
    fun createTag(name: String, color: String?, userId: Long): TagDto {
        val existing = tagRepo.findByNameIgnoreCase(name.trim())
        if (existing != null) return existing.toDto(0)
        val tag = tagRepo.save(Tag(name = name.trim(), color = color, createdBy = userId))
        return tag.toDto(0)
    }

    @Transactional
    fun updateTag(tagId: Long, request: TagUpdateRequest): TagDto {
        val tag = tagRepo.findById(tagId)
            .orElseThrow { NoSuchElementException("Tag not found: $tagId") }
        request.name?.let { tag.name = it.trim() }
        request.color?.let { tag.color = it }
        return tagRepo.save(tag).toDto(0)
    }

    @Transactional
    fun deleteTag(tagId: Long) {
        tagRepo.deleteById(tagId)
    }

    // ─── Tag assignments ───

    fun getObjectTags(objectType: String, objectId: Long): List<ObjectTagDto> {
        return objectTagRepo.findByObjectTypeAndObjectId(objectType, objectId)
            .map { ObjectTagDto(it.tag.id, it.tag.name, it.tag.color) }
    }

    @Transactional
    fun assignTag(tagId: Long, objectType: String, objectId: Long, userId: Long): ObjectTagDto {
        val existing = objectTagRepo.findByObjectTypeAndObjectIdAndTagId(objectType, objectId, tagId)
        if (existing != null) return ObjectTagDto(existing.tag.id, existing.tag.name, existing.tag.color)

        val tag = tagRepo.findById(tagId)
            .orElseThrow { NoSuchElementException("Tag not found: $tagId") }
        objectTagRepo.save(ObjectTag(tag = tag, objectType = objectType, objectId = objectId, taggedBy = userId))
        return ObjectTagDto(tag.id, tag.name, tag.color)
    }

    @Transactional
    fun removeTag(objectType: String, objectId: Long, tagId: Long) {
        objectTagRepo.deleteByObjectTypeAndObjectIdAndTagId(objectType, objectId, tagId)
    }

    @Transactional
    fun setObjectTags(tagIds: List<Long>, objectType: String, objectId: Long, userId: Long): List<ObjectTagDto> {
        objectTagRepo.deleteByObjectTypeAndObjectId(objectType, objectId)
        return tagIds.mapNotNull { tagId ->
            val tag = tagRepo.findById(tagId).orElse(null) ?: return@mapNotNull null
            objectTagRepo.save(ObjectTag(tag = tag, objectType = objectType, objectId = objectId, taggedBy = userId))
            ObjectTagDto(tag.id, tag.name, tag.color)
        }
    }

    private fun Tag.toDto(count: Int) = TagDto(id, name, color, count, createdAt)
}


@Service
class GlobalSearchService(
    private val reportRepo: ReportRepository,
    private val dataSourceRepository: DataSourceRepository,
    private val savedQueryRepo: SavedQueryRepository,
    private val objectTagRepo: ObjectTagRepository
) {

    fun search(request: SearchRequest): SearchResponse {
        val q = request.query.lowercase().trim()
        if (q.isBlank()) return SearchResponse(emptyList(), 0, request.query)

        val types = request.types?.map { it.uppercase() }
            ?: listOf("REPORT", "DATASOURCE", "QUERY")

        val results = mutableListOf<SearchResult>()

        // Search reports
        if ("REPORT" in types) {
            reportRepo.findAll().filter { matchesQuery(it.name, it.description, q) }
                .forEach { r ->
                    results.add(SearchResult(
                        objectType = "REPORT",
                        objectId = r.id,
                        name = r.name,
                        description = r.description,
                        updatedAt = r.updatedAt.atOffset(ZoneOffset.UTC),
                        relevance = calcRelevance(r.name, r.description, q)
                    ))
                }
        }

        // Search datasources
        if ("DATASOURCE" in types) {
            dataSourceRepository.findAll().filter { matchesQuery(it.name, it.description, q) }
                .forEach { ds ->
                    results.add(SearchResult(
                        objectType = "DATASOURCE",
                        objectId = ds.id,
                        name = ds.name,
                        description = ds.description,
                        updatedAt = ds.updatedAt,
                        relevance = calcRelevance(ds.name, ds.description, q)
                    ))
                }
        }

        // Search queries
        if ("QUERY" in types) {
            savedQueryRepo.findAll().filter { matchesQuery(it.name, it.description, q) }
                .forEach { sq ->
                    results.add(SearchResult(
                        objectType = "QUERY",
                        objectId = sq.id,
                        name = sq.name,
                        description = sq.description,
                        updatedAt = sq.updatedAt,
                        relevance = calcRelevance(sq.name, sq.description, q)
                    ))
                }
        }

        // Filter by tags if specified
        val filtered = if (!request.tags.isNullOrEmpty()) {
            val taggedObjects = request.tags.flatMap { tagId -> objectTagRepo.findByTagId(tagId) }
                .map { "${it.objectType}:${it.objectId}" }
                .toSet()
            results.filter { "${it.objectType}:${it.objectId}" in taggedObjects }
        } else results

        // Enrich with tags
        val enriched = filtered.map { result ->
            val tags = objectTagRepo.findByObjectTypeAndObjectId(result.objectType, result.objectId)
                .map { ObjectTagDto(it.tag.id, it.tag.name, it.tag.color) }
            result.copy(tags = tags)
        }

        // Sort by relevance, paginate
        val sorted = enriched.sortedByDescending { it.relevance }
        val total = sorted.size
        val paged = sorted.drop(request.offset).take(request.limit)

        return SearchResponse(paged, total, request.query)
    }

    private fun matchesQuery(name: String, description: String?, query: String): Boolean {
        return name.lowercase().contains(query) ||
               (description?.lowercase()?.contains(query) == true)
    }

    private fun calcRelevance(name: String, description: String?, query: String): Double {
        var score = 0.0
        val nameLower = name.lowercase()
        if (nameLower == query) score += 10.0
        else if (nameLower.startsWith(query)) score += 5.0
        else if (nameLower.contains(query)) score += 3.0
        if (description?.lowercase()?.contains(query) == true) score += 1.0
        return score
    }
}
