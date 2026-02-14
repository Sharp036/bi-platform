package com.datorio.service

import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.ReportRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class TemplateService(
    private val reportRepo: ReportRepository,
    private val reportService: ReportService
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ═══════════════════════════════════════════
    //  Template Gallery
    // ═══════════════════════════════════════════

    fun listTemplates(category: String?, pageable: Pageable): List<TemplateListItem> {
        val page = if (category != null) {
            reportRepo.findByIsTemplateTrueAndTemplateCategory(category, pageable)
        } else {
            reportRepo.findByIsTemplateTrue(pageable)
        }
        return page.content.map { it.toTemplateItem() }
    }

    fun getCategories(): List<String> {
        return reportRepo.findDistinctTemplateCategories()
    }

    @Transactional
    fun updateTemplateMeta(reportId: Long, req: TemplateUpdateRequest) {
        val report = reportRepo.findById(reportId)
            .orElseThrow { NoSuchElementException("Report not found: $reportId") }
        require(report.isTemplate) { "Report $reportId is not a template" }
        req.category?.let { report.templateCategory = it }
        req.preview?.let { report.templatePreview = it }
        req.thumbnailUrl?.let { report.thumbnailUrl = it }
        report.updatedAt = Instant.now()
        reportRepo.save(report)
    }

    @Transactional
    fun markAsTemplate(reportId: Long, category: String?, preview: String?): TemplateListItem {
        val report = reportRepo.findById(reportId)
            .orElseThrow { NoSuchElementException("Report not found: $reportId") }
        report.isTemplate = true
        report.templateCategory = category
        report.templatePreview = preview
        report.updatedAt = Instant.now()
        return reportRepo.save(report).toTemplateItem()
    }

    @Transactional
    fun unmarkAsTemplate(reportId: Long) {
        val report = reportRepo.findById(reportId)
            .orElseThrow { NoSuchElementException("Report not found: $reportId") }
        report.isTemplate = false
        report.templateCategory = null
        report.templatePreview = null
        report.updatedAt = Instant.now()
        reportRepo.save(report)
    }

    // ═══════════════════════════════════════════
    //  JSON Export
    // ═══════════════════════════════════════════

    fun exportReport(reportId: Long): ReportExportConfig {
        val report = reportRepo.findById(reportId)
            .orElseThrow { NoSuchElementException("Report not found: $reportId") }

        return ReportExportConfig(
            name = report.name,
            description = report.description,
            reportType = report.reportType,
            layout = report.layout,
            settings = report.settings,
            category = report.templateCategory,
            parameters = report.parameters.sortedBy { it.sortOrder }.map { p ->
                ParameterExportConfig(
                    name = p.name, label = p.label, paramType = p.paramType,
                    defaultValue = p.defaultValue, isRequired = p.isRequired,
                    sortOrder = p.sortOrder, config = p.config
                )
            },
            widgets = report.widgets.sortedBy { it.sortOrder }.map { w ->
                WidgetExportConfig(
                    widgetType = w.widgetType, title = w.title,
                    rawSql = w.rawSql, chartConfig = w.chartConfig,
                    position = w.position, style = w.style,
                    paramMapping = w.paramMapping, sortOrder = w.sortOrder,
                    isVisible = w.isVisible
                )
            }
        )
    }

    // ═══════════════════════════════════════════
    //  JSON Import
    // ═══════════════════════════════════════════

    @Transactional
    fun importReport(req: ImportReportRequest, userId: Long): ImportResult {
        val cfg = req.config
        val reportName = req.name ?: cfg.name

        val createReq = CreateReportRequest(
            name = reportName,
            description = cfg.description,
            reportType = cfg.reportType,
            layout = cfg.layout,
            settings = cfg.settings,
            isTemplate = req.asTemplate,
            folderId = req.folderId,
            parameters = cfg.parameters.map { p ->
                ReportParameterDto(
                    name = p.name, label = p.label, paramType = p.paramType,
                    defaultValue = p.defaultValue, isRequired = p.isRequired,
                    sortOrder = p.sortOrder, config = p.config
                )
            },
            widgets = cfg.widgets.map { w ->
                CreateWidgetRequest(
                    widgetType = w.widgetType, title = w.title,
                    datasourceId = req.datasourceId,
                    rawSql = w.rawSql, chartConfig = w.chartConfig,
                    position = w.position, style = w.style,
                    paramMapping = w.paramMapping, sortOrder = w.sortOrder,
                    isVisible = w.isVisible
                )
            }
        )

        val created = reportService.createReport(createReq, userId)

        // Set category if importing as template
        if (req.asTemplate && cfg.category != null) {
            val report = reportRepo.findById(created.id).orElse(null)
            report?.let {
                it.templateCategory = cfg.category
                reportRepo.save(it)
            }
        }

        log.info("Imported report '{}' (id={}, widgets={}, params={})",
            reportName, created.id, created.widgets.size, created.parameters.size)

        return ImportResult(
            reportId = created.id,
            name = reportName,
            widgetCount = created.widgets.size,
            parameterCount = created.parameters.size
        )
    }

    // ═══════════════════════════════════════════

    private fun Report.toTemplateItem() = TemplateListItem(
        id = id, name = name, description = description,
        category = templateCategory, preview = templatePreview,
        thumbnailUrl = thumbnailUrl, widgetCount = widgets.size,
        createdAt = createdAt.toString()
    )
}
