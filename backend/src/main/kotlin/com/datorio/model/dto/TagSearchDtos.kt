package com.datorio.model.dto

import java.time.OffsetDateTime

// ═══════════════════════════════════════════
//  Tags
// ═══════════════════════════════════════════

data class TagDto(
    val id: Long,
    val name: String,
    val color: String?,
    val usageCount: Int = 0,
    val createdAt: OffsetDateTime
)

data class TagCreateRequest(
    val name: String,
    val color: String? = null
)

data class TagUpdateRequest(
    val name: String? = null,
    val color: String? = null
)

data class TagAssignRequest(
    val tagId: Long,
    val objectType: String,
    val objectId: Long
)

data class BulkTagRequest(
    val tagIds: List<Long>,
    val objectType: String,
    val objectId: Long
)

data class ObjectTagDto(
    val tagId: Long,
    val tagName: String,
    val tagColor: String?
)

// ═══════════════════════════════════════════
//  Global Search
// ═══════════════════════════════════════════

data class SearchRequest(
    val query: String,
    val types: List<String>? = null,  // REPORT, DATASOURCE, DASHBOARD, QUERY
    val tags: List<Long>? = null,
    val limit: Int = 20,
    val offset: Int = 0
)

data class SearchResult(
    val objectType: String,
    val objectId: Long,
    val name: String,
    val description: String?,
    val tags: List<ObjectTagDto> = emptyList(),
    val updatedAt: OffsetDateTime?,
    val relevance: Double = 0.0
)

data class SearchResponse(
    val results: List<SearchResult>,
    val total: Int,
    val query: String
)
