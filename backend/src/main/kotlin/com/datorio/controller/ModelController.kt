package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.repository.UserRepository
import com.datorio.service.ModelService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/modeling")
class ModelController(
    private val modelService: ModelService,
    private val userRepository: UserRepository
) {

    private fun getUserId(user: UserDetails): Long =
        userRepository.findByUsername(user.username)
            .orElseThrow { NoSuchElementException("User not found") }.id

    // ─── Models ───

    @GetMapping("/models")
    fun list(@AuthenticationPrincipal user: UserDetails): ResponseEntity<List<DataModelResponse>> =
        ResponseEntity.ok(modelService.getModels(getUserId(user)))

    @GetMapping("/models/{id}")
    fun detail(@PathVariable id: Long): ResponseEntity<DataModelDetailResponse> =
        ResponseEntity.ok(modelService.getModelDetail(id))

    @PostMapping("/models")
    fun create(
        @Valid @RequestBody request: DataModelCreateRequest,
        @AuthenticationPrincipal user: UserDetails
    ): ResponseEntity<DataModelResponse> =
        ResponseEntity.ok(modelService.createModel(getUserId(user), request))

    @PutMapping("/models/{id}")
    fun update(
        @PathVariable id: Long,
        @Valid @RequestBody request: DataModelUpdateRequest
    ): ResponseEntity<DataModelResponse> =
        ResponseEntity.ok(modelService.updateModel(id, request))

    @DeleteMapping("/models/{id}")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        modelService.deleteModel(id)
        return ResponseEntity.noContent().build()
    }

    // ─── Tables ───

    @PostMapping("/models/{modelId}/tables")
    fun addTable(
        @PathVariable modelId: Long,
        @Valid @RequestBody request: ModelTableRequest
    ): ResponseEntity<ModelTableResponse> =
        ResponseEntity.ok(modelService.addTable(modelId, request))

    @DeleteMapping("/tables/{tableId}")
    fun removeTable(@PathVariable tableId: Long): ResponseEntity<Void> {
        modelService.removeTable(tableId)
        return ResponseEntity.noContent().build()
    }

    // ─── Fields ───

    @PostMapping("/tables/{tableId}/fields")
    fun addField(
        @PathVariable tableId: Long,
        @Valid @RequestBody request: ModelFieldRequest
    ): ResponseEntity<ModelFieldResponse> =
        ResponseEntity.ok(modelService.addField(tableId, request))

    @PutMapping("/fields/{fieldId}")
    fun updateField(
        @PathVariable fieldId: Long,
        @Valid @RequestBody request: ModelFieldRequest
    ): ResponseEntity<ModelFieldResponse> =
        ResponseEntity.ok(modelService.updateField(fieldId, request))

    @DeleteMapping("/fields/{fieldId}")
    fun removeField(@PathVariable fieldId: Long): ResponseEntity<Void> {
        modelService.removeField(fieldId)
        return ResponseEntity.noContent().build()
    }

    // ─── Relationships ───

    @PostMapping("/models/{modelId}/relationships")
    fun addRelationship(
        @PathVariable modelId: Long,
        @Valid @RequestBody request: ModelRelationshipRequest
    ): ResponseEntity<ModelRelationshipResponse> =
        ResponseEntity.ok(modelService.addRelationship(modelId, request))

    @DeleteMapping("/relationships/{relId}")
    fun removeRelationship(@PathVariable relId: Long): ResponseEntity<Void> {
        modelService.removeRelationship(relId)
        return ResponseEntity.noContent().build()
    }

    // ─── Auto-Import ───

    @PostMapping("/models/{modelId}/auto-import")
    fun autoImport(
        @PathVariable modelId: Long,
        @Valid @RequestBody request: AutoImportRequest
    ): ResponseEntity<DataModelDetailResponse> =
        ResponseEntity.ok(modelService.autoImport(modelId, request))

    // ─── Explore (query via model) ───

    @PostMapping("/explore")
    fun explore(
        @Valid @RequestBody request: ExploreRequest
    ): ResponseEntity<ExploreResponse> =
        ResponseEntity.ok(modelService.explore(request))
}
