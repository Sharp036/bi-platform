package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.repository.UserRepository
import com.datorio.service.GlobalSearchService
import com.datorio.service.TagService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

// ═══════════════════════════════════════════
//  Tags
// ═══════════════════════════════════════════

@RestController
@RequestMapping("/tags")
class TagController(
    private val tagService: TagService,
    private val userRepository: UserRepository
) {
    private fun getUserId(user: UserDetails): Long =
        userRepository.findByUsername(user.username)
            .orElseThrow { NoSuchElementException("User not found") }.id

    @GetMapping
    fun list(): ResponseEntity<List<TagDto>> =
        ResponseEntity.ok(tagService.listTags())

    @GetMapping("/search")
    fun search(@RequestParam q: String): ResponseEntity<List<TagDto>> =
        ResponseEntity.ok(tagService.searchTags(q))

    @PostMapping
    fun create(
        @Valid @RequestBody request: TagCreateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<TagDto> =
        ResponseEntity.ok(tagService.createTag(request.name, request.color, getUserId(user)))

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @Valid @RequestBody request: TagUpdateRequest
    ): ResponseEntity<TagDto> =
        ResponseEntity.ok(tagService.updateTag(id, request))

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        tagService.deleteTag(id)
        return ResponseEntity.noContent().build()
    }

    /** Get tags for an object */
    @GetMapping("/object/{objectType}/{objectId}")
    fun objectTags(
        @PathVariable objectType: String,
        @PathVariable objectId: Long
    ): ResponseEntity<List<ObjectTagDto>> =
        ResponseEntity.ok(tagService.getObjectTags(objectType.uppercase(), objectId))

    /** Assign a tag to an object */
    @PostMapping("/assign")
    fun assign(
        @Valid @RequestBody request: TagAssignRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<ObjectTagDto> =
        ResponseEntity.ok(tagService.assignTag(request.tagId, request.objectType, request.objectId, getUserId(user)))

    /** Set all tags for an object (replace) */
    @PostMapping("/bulk")
    fun bulkSet(
        @Valid @RequestBody request: BulkTagRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<List<ObjectTagDto>> =
        ResponseEntity.ok(tagService.setObjectTags(request.tagIds, request.objectType, request.objectId, getUserId(user)))

    /** Remove a tag from an object */
    @DeleteMapping("/object/{objectType}/{objectId}/{tagId}")
    fun removeTag(
        @PathVariable objectType: String,
        @PathVariable objectId: Long,
        @PathVariable tagId: Long
    ): ResponseEntity<Void> {
        tagService.removeTag(objectType.uppercase(), objectId, tagId)
        return ResponseEntity.noContent().build()
    }
}

// ═══════════════════════════════════════════
//  Global Search
// ═══════════════════════════════════════════

@RestController
@RequestMapping("/search")
class SearchController(
    private val searchService: GlobalSearchService
) {

    @GetMapping
    fun search(
        @RequestParam q: String,
        @RequestParam(required = false) types: List<String>?,
        @RequestParam(required = false) tags: List<Long>?,
        @RequestParam(defaultValue = "20") limit: Int,
        @RequestParam(defaultValue = "0") offset: Int
    ): ResponseEntity<SearchResponse> {
        val request = SearchRequest(
            query = q,
            types = types,
            tags = tags,
            limit = limit,
            offset = offset
        )
        return ResponseEntity.ok(searchService.search(request))
    }
}
