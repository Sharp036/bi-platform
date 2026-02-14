package com.datorio.controller

import com.datorio.model.dto.*
import com.datorio.service.ControlService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/controls")
class ControlController(
    private val controlService: ControlService
) {

    // ─── Global Filter Config ───

    @GetMapping("/filters/{reportId}")
    fun getFilters(@PathVariable reportId: Long): ResponseEntity<List<GlobalFilterConfigResponse>> =
        ResponseEntity.ok(controlService.getFiltersForReport(reportId))

    @GetMapping("/filters/{reportId}/active")
    fun getActiveFilters(@PathVariable reportId: Long): ResponseEntity<List<GlobalFilterConfigResponse>> =
        ResponseEntity.ok(controlService.getActiveFilters(reportId))

    @GetMapping("/filters/{reportId}/sources")
    fun getFilterSources(@PathVariable reportId: Long): ResponseEntity<List<GlobalFilterConfigResponse>> =
        ResponseEntity.ok(controlService.getFilterSources(reportId))

    @PostMapping("/filters")
    fun saveFilter(
        @Valid @RequestBody request: GlobalFilterConfigRequest
    ): ResponseEntity<GlobalFilterConfigResponse> =
        ResponseEntity.ok(controlService.saveFilterConfig(request))

    @DeleteMapping("/filters/{reportId}/{widgetId}")
    fun deleteFilter(
        @PathVariable reportId: Long,
        @PathVariable widgetId: Long
    ): ResponseEntity<Void> {
        controlService.deleteFilterConfig(reportId, widgetId)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/filters/{reportId}/resolve-targets")
    fun resolveTargets(
        @PathVariable reportId: Long,
        @RequestParam sourceWidgetId: Long,
        @RequestBody allWidgetIds: List<Long>
    ): ResponseEntity<List<Long>> =
        ResponseEntity.ok(controlService.resolveFilterTargets(reportId, sourceWidgetId, allWidgetIds))

    // ─── Parameter Controls ───

    @GetMapping("/parameters/{reportId}")
    fun getParameterControls(
        @PathVariable reportId: Long
    ): ResponseEntity<List<ParameterControlResponse>> =
        ResponseEntity.ok(controlService.getParameterControls(reportId))

    @PostMapping("/parameters")
    fun saveParameterControl(
        @Valid @RequestBody request: ParameterControlRequest
    ): ResponseEntity<ParameterControlResponse> =
        ResponseEntity.ok(controlService.saveParameterControl(request))

    @DeleteMapping("/parameters/{reportId}/{parameterName}")
    fun deleteParameterControl(
        @PathVariable reportId: Long,
        @PathVariable parameterName: String
    ): ResponseEntity<Void> {
        controlService.deleteParameterControl(reportId, parameterName)
        return ResponseEntity.noContent().build()
    }

    @GetMapping("/parameters/{reportId}/{parameterName}/options")
    fun loadOptions(
        @PathVariable reportId: Long,
        @PathVariable parameterName: String,
        @RequestParam parentValues: Map<String, String>?
    ): ResponseEntity<ParameterOptionsResponse> =
        ResponseEntity.ok(
            controlService.loadParameterOptions(reportId, parameterName, parentValues ?: emptyMap())
        )
}
