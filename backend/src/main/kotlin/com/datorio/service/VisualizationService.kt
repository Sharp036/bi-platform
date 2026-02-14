package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class VisualizationService(
    private val annotationRepo: ChartAnnotationRepository,
    private val tooltipRepo: TooltipConfigRepository,
    private val containerRepo: WidgetContainerRepository,
    private val objectMapper: ObjectMapper
) {

    // ═══════════════════════════════════════════
    //  Annotations
    // ═══════════════════════════════════════════

    fun getAnnotations(widgetId: Long): List<AnnotationResponse> =
        annotationRepo.findByWidgetIdOrderBySortOrder(widgetId).map { it.toResponse() }

    fun getVisibleAnnotations(widgetId: Long): List<AnnotationResponse> =
        annotationRepo.findByWidgetIdAndIsVisibleTrueOrderBySortOrder(widgetId).map { it.toResponse() }

    fun getAnnotationsForWidgets(widgetIds: List<Long>): Map<Long, List<AnnotationResponse>> =
        widgetIds.associateWith { getVisibleAnnotations(it) }.filterValues { it.isNotEmpty() }

    @Transactional
    fun createAnnotation(req: AnnotationRequest): AnnotationResponse {
        val ann = ChartAnnotation(
            widgetId = req.widgetId, annotationType = req.annotationType,
            axis = req.axis, value = req.value, valueEnd = req.valueEnd,
            label = req.label, color = req.color, lineStyle = req.lineStyle,
            lineWidth = req.lineWidth, opacity = req.opacity,
            fillColor = req.fillColor, fillOpacity = req.fillOpacity,
            position = req.position, fontSize = req.fontSize,
            isVisible = req.isVisible, sortOrder = req.sortOrder,
            config = objectMapper.writeValueAsString(req.config)
        )
        return annotationRepo.save(ann).toResponse()
    }

    @Transactional
    fun updateAnnotation(id: Long, req: AnnotationRequest): AnnotationResponse {
        val ann = annotationRepo.findById(id)
            .orElseThrow { NoSuchElementException("Annotation not found: $id") }
        ann.annotationType = req.annotationType; ann.axis = req.axis
        ann.value = req.value; ann.valueEnd = req.valueEnd
        ann.label = req.label; ann.color = req.color
        ann.lineStyle = req.lineStyle; ann.lineWidth = req.lineWidth
        ann.opacity = req.opacity; ann.fillColor = req.fillColor
        ann.fillOpacity = req.fillOpacity; ann.position = req.position
        ann.fontSize = req.fontSize; ann.isVisible = req.isVisible
        ann.sortOrder = req.sortOrder
        ann.config = objectMapper.writeValueAsString(req.config)
        return annotationRepo.save(ann).toResponse()
    }

    @Transactional
    fun deleteAnnotation(id: Long) { annotationRepo.deleteById(id) }

    // ═══════════════════════════════════════════
    //  Tooltip Config
    // ═══════════════════════════════════════════

    fun getTooltipConfig(widgetId: Long): TooltipConfigResponse? =
        tooltipRepo.findByWidgetId(widgetId)?.toResponse()

    fun getTooltipConfigs(widgetIds: List<Long>): Map<Long, TooltipConfigResponse> =
        widgetIds.mapNotNull { wid -> tooltipRepo.findByWidgetId(wid)?.toResponse()?.let { wid to it } }.toMap()

    @Transactional
    fun saveTooltipConfig(req: TooltipConfigRequest): TooltipConfigResponse {
        val existing = tooltipRepo.findByWidgetId(req.widgetId)
        val tc = if (existing != null) {
            existing.isEnabled = req.isEnabled; existing.showTitle = req.showTitle
            existing.titleField = req.titleField
            existing.fields = objectMapper.writeValueAsString(req.fields)
            existing.showSparkline = req.showSparkline
            existing.sparklineField = req.sparklineField
            existing.htmlTemplate = req.htmlTemplate
            existing.config = objectMapper.writeValueAsString(req.config)
            existing
        } else {
            TooltipConfig(
                widgetId = req.widgetId, isEnabled = req.isEnabled,
                showTitle = req.showTitle, titleField = req.titleField,
                fields = objectMapper.writeValueAsString(req.fields),
                showSparkline = req.showSparkline,
                sparklineField = req.sparklineField,
                htmlTemplate = req.htmlTemplate,
                config = objectMapper.writeValueAsString(req.config)
            )
        }
        return tooltipRepo.save(tc).toResponse()
    }

    @Transactional
    fun deleteTooltipConfig(widgetId: Long) { tooltipRepo.deleteByWidgetId(widgetId) }

    // ═══════════════════════════════════════════
    //  Containers
    // ═══════════════════════════════════════════

    fun getContainers(reportId: Long): List<ContainerResponse> =
        containerRepo.findByReportIdOrderBySortOrder(reportId).map { it.toResponse() }

    @Transactional
    fun createContainer(req: ContainerRequest): ContainerResponse {
        val c = WidgetContainer(
            reportId = req.reportId, containerType = req.containerType,
            name = req.name, childWidgetIds = req.childWidgetIds.joinToString(","),
            activeTab = req.activeTab, autoDistribute = req.autoDistribute,
            config = objectMapper.writeValueAsString(req.config),
            sortOrder = req.sortOrder
        )
        return containerRepo.save(c).toResponse()
    }

    @Transactional
    fun updateContainer(id: Long, req: ContainerRequest): ContainerResponse {
        val c = containerRepo.findById(id)
            .orElseThrow { NoSuchElementException("Container not found: $id") }
        c.containerType = req.containerType; c.name = req.name
        c.childWidgetIds = req.childWidgetIds.joinToString(",")
        c.activeTab = req.activeTab; c.autoDistribute = req.autoDistribute
        c.config = objectMapper.writeValueAsString(req.config)
        c.sortOrder = req.sortOrder
        return containerRepo.save(c).toResponse()
    }

    @Transactional
    fun deleteContainer(id: Long) { containerRepo.deleteById(id) }

    // ═══════════════════════════════════════════
    //  Mappers
    // ═══════════════════════════════════════════

    private fun ChartAnnotation.toResponse() = AnnotationResponse(
        id = id, widgetId = widgetId, annotationType = annotationType,
        axis = axis, value = value, valueEnd = valueEnd,
        label = label, color = color, lineStyle = lineStyle,
        lineWidth = lineWidth, opacity = opacity,
        fillColor = fillColor, fillOpacity = fillOpacity,
        position = position, fontSize = fontSize,
        isVisible = isVisible, sortOrder = sortOrder,
        config = parseJson(config), createdAt = createdAt
    )

    private fun TooltipConfig.toResponse(): TooltipConfigResponse {
        val fieldList: List<TooltipFieldDef> = try {
            objectMapper.readValue(fields)
        } catch (_: Exception) { emptyList() }
        return TooltipConfigResponse(
            id = id, widgetId = widgetId, isEnabled = isEnabled,
            showTitle = showTitle, titleField = titleField,
            fields = fieldList, showSparkline = showSparkline,
            sparklineField = sparklineField, htmlTemplate = htmlTemplate,
            config = parseJson(config), createdAt = createdAt
        )
    }

    private fun WidgetContainer.toResponse() = ContainerResponse(
        id = id, reportId = reportId, containerType = containerType,
        name = name,
        childWidgetIds = childWidgetIds.split(",").mapNotNull { it.trim().toLongOrNull() },
        activeTab = activeTab, autoDistribute = autoDistribute,
        config = parseJson(config), sortOrder = sortOrder, createdAt = createdAt
    )

    private fun parseJson(raw: String): Map<String, Any?> = try {
        objectMapper.readValue(raw)
    } catch (_: Exception) { emptyMap() }
}
