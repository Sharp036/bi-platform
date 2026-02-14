package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.service.VisualizationService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/visualization")
class VisualizationController(
    private val vizService: VisualizationService
) {

    // ─── Annotations ───

    @GetMapping("/annotations/widget/{widgetId}")
    fun getAnnotations(@PathVariable widgetId: Long): ResponseEntity<List<AnnotationResponse>> =
        ResponseEntity.ok(vizService.getAnnotations(widgetId))

    @GetMapping("/annotations/widgets")
    fun getAnnotationsForWidgets(
        @RequestParam widgetIds: List<Long>
    ): ResponseEntity<Map<Long, List<AnnotationResponse>>> =
        ResponseEntity.ok(vizService.getAnnotationsForWidgets(widgetIds))

    @PostMapping("/annotations")
    fun createAnnotation(
        @Valid @RequestBody request: AnnotationRequest
    ): ResponseEntity<AnnotationResponse> =
        ResponseEntity.ok(vizService.createAnnotation(request))

    @PutMapping("/annotations/{id}")
    fun updateAnnotation(
        @PathVariable id: Long,
        @Valid @RequestBody request: AnnotationRequest
    ): ResponseEntity<AnnotationResponse> =
        ResponseEntity.ok(vizService.updateAnnotation(id, request))

    @DeleteMapping("/annotations/{id}")
    fun deleteAnnotation(@PathVariable id: Long): ResponseEntity<Void> {
        vizService.deleteAnnotation(id)
        return ResponseEntity.noContent().build()
    }

    // ─── Tooltips ───

    @GetMapping("/tooltips/widget/{widgetId}")
    fun getTooltip(@PathVariable widgetId: Long): ResponseEntity<TooltipConfigResponse?> =
        ResponseEntity.ok(vizService.getTooltipConfig(widgetId))

    @GetMapping("/tooltips/widgets")
    fun getTooltips(
        @RequestParam widgetIds: List<Long>
    ): ResponseEntity<Map<Long, TooltipConfigResponse>> =
        ResponseEntity.ok(vizService.getTooltipConfigs(widgetIds))

    @PostMapping("/tooltips")
    fun saveTooltip(
        @Valid @RequestBody request: TooltipConfigRequest
    ): ResponseEntity<TooltipConfigResponse> =
        ResponseEntity.ok(vizService.saveTooltipConfig(request))

    @DeleteMapping("/tooltips/widget/{widgetId}")
    fun deleteTooltip(@PathVariable widgetId: Long): ResponseEntity<Void> {
        vizService.deleteTooltipConfig(widgetId)
        return ResponseEntity.noContent().build()
    }

    // ─── Containers ───

    @GetMapping("/containers/{reportId}")
    fun getContainers(@PathVariable reportId: Long): ResponseEntity<List<ContainerResponse>> =
        ResponseEntity.ok(vizService.getContainers(reportId))

    @PostMapping("/containers")
    fun createContainer(
        @Valid @RequestBody request: ContainerRequest
    ): ResponseEntity<ContainerResponse> =
        ResponseEntity.ok(vizService.createContainer(request))

    @PutMapping("/containers/{id}")
    fun updateContainer(
        @PathVariable id: Long,
        @Valid @RequestBody request: ContainerRequest
    ): ResponseEntity<ContainerResponse> =
        ResponseEntity.ok(vizService.updateContainer(id, request))

    @DeleteMapping("/containers/{id}")
    fun deleteContainer(@PathVariable id: Long): ResponseEntity<Void> {
        vizService.deleteContainer(id)
        return ResponseEntity.noContent().build()
    }
}
