package com.datorio.service

import com.datorio.model.Bookmark
import com.datorio.model.dto.*
import com.datorio.repository.BookmarkRepository
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class BookmarkService(
    private val bookmarkRepo: BookmarkRepository,
    private val objectMapper: ObjectMapper
) {

    @Transactional
    fun create(request: BookmarkCreateRequest, userId: Long): BookmarkResponse {
        // If setting as default, unset other defaults
        if (request.isDefault) {
            val existing = bookmarkRepo.findByReportIdAndIsDefaultTrue(request.reportId)
            if (existing != null) {
                existing.isDefault = false
                bookmarkRepo.save(existing)
            }
        }

        val bookmark = Bookmark(
            reportId = request.reportId,
            name = request.name,
            description = request.description,
            parameters = objectMapper.writeValueAsString(request.parameters),
            filters = objectMapper.writeValueAsString(request.filters),
            isDefault = request.isDefault,
            isShared = request.isShared,
            createdBy = userId
        )
        return toResponse(bookmarkRepo.save(bookmark))
    }

    @Transactional
    fun update(id: Long, request: BookmarkUpdateRequest): BookmarkResponse {
        val bookmark = bookmarkRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Bookmark not found: $id") }

        request.name?.let { bookmark.name = it }
        request.description?.let { bookmark.description = it }
        request.parameters?.let { bookmark.parameters = objectMapper.writeValueAsString(it) }
        request.filters?.let { bookmark.filters = objectMapper.writeValueAsString(it) }
        request.isDefault?.let { isDefault ->
            if (isDefault) {
                val existing = bookmarkRepo.findByReportIdAndIsDefaultTrue(bookmark.reportId)
                if (existing != null && existing.id != id) {
                    existing.isDefault = false
                    bookmarkRepo.save(existing)
                }
            }
            bookmark.isDefault = isDefault
        }
        request.isShared?.let { bookmark.isShared = it }
        bookmark.updatedAt = Instant.now()

        return toResponse(bookmarkRepo.save(bookmark))
    }

    fun getById(id: Long): BookmarkResponse {
        return toResponse(bookmarkRepo.findById(id)
            .orElseThrow { IllegalArgumentException("Bookmark not found: $id") })
    }

    fun listForReport(reportId: Long, userId: Long): List<BookmarkResponse> {
        return bookmarkRepo.findAccessibleBookmarks(reportId, userId).map { toResponse(it) }
    }

    fun getDefaultBookmark(reportId: Long): BookmarkResponse? {
        return bookmarkRepo.findByReportIdAndIsDefaultTrue(reportId)?.let { toResponse(it) }
    }

    @Transactional
    fun delete(id: Long) {
        require(bookmarkRepo.existsById(id)) { "Bookmark not found: $id" }
        bookmarkRepo.deleteById(id)
    }

    private fun toResponse(b: Bookmark): BookmarkResponse {
        val params: Map<String, Any?> = try {
            objectMapper.readValue(b.parameters)
        } catch (_: Exception) { emptyMap() }

        val filters: Map<String, Any?> = try {
            objectMapper.readValue(b.filters)
        } catch (_: Exception) { emptyMap() }

        return BookmarkResponse(
            id = b.id, reportId = b.reportId, name = b.name,
            description = b.description, parameters = params, filters = filters,
            isDefault = b.isDefault, isShared = b.isShared,
            createdBy = b.createdBy, createdAt = b.createdAt, updatedAt = b.updatedAt
        )
    }
}
