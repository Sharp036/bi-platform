package com.datorio.service

import com.datorio.model.OutputFormat
import com.datorio.model.dto.*
import com.datorio.repository.ReportSnapshotRepository
import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

@Service
class ExportService(
    private val renderService: ReportRenderService,
    private val snapshotRepo: ReportSnapshotRepository,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Value("\${datorio.export.directory:/tmp/datalens-exports}")
    private lateinit var exportDir: String

    /**
     * Export a report to the requested format. Returns file bytes.
     */
    fun exportReport(
        reportId: Long,
        request: ExportRequest,
        username: String
    ): Pair<ByteArray, String> {
        // Render the report
        val renderResult = renderService.renderReport(
            reportId, RenderReportRequest(request.parameters), username
        )

        // Filter widgets if specified
        val widgets = if (request.widgetIds != null) {
            renderResult.widgets.filter { it.widgetId in request.widgetIds }
        } else {
            renderResult.widgets
        }.filter { it.data != null }

        return when (request.format.uppercase()) {
            "CSV" -> exportCsv(renderResult.reportName, widgets, request) to
                "${sanitizeFilename(renderResult.reportName)}.csv"
            "EXCEL", "XLSX" -> exportExcel(renderResult.reportName, widgets, request) to
                "${sanitizeFilename(renderResult.reportName)}.xlsx"
            "PDF" -> exportPdf(renderResult.reportName, widgets, request) to
                "${sanitizeFilename(renderResult.reportName)}.pdf"
            else -> throw IllegalArgumentException("Unsupported format: ${request.format}")
        }
    }

    /**
     * Export and save to disk, returning the snapshot with file path.
     */
    fun exportAndSave(reportId: Long, request: ExportRequest, username: String): ExportStatusResponse {
        val (bytes, filename) = exportReport(reportId, request, username)

        // Ensure export directory exists
        val dir = Paths.get(exportDir)
        Files.createDirectories(dir)

        // Save file
        val timestamp = System.currentTimeMillis()
        val filePath = dir.resolve("${timestamp}_$filename")
        Files.write(filePath, bytes)

        // Save snapshot
        val format = when (request.format.uppercase()) {
            "CSV" -> OutputFormat.CSV
            "EXCEL", "XLSX" -> OutputFormat.EXCEL
            "PDF" -> OutputFormat.PDF
            else -> OutputFormat.JSON
        }

        val snapshot = renderService.renderAndSnapshot(
            reportId = reportId,
            params = request.parameters,
            username = username,
            outputFormat = format
        )
        snapshot.filePath = filePath.toString()
        snapshotRepo.save(snapshot)

        log.info("Exported report {} as {} → {}", reportId, request.format, filePath)

        return ExportStatusResponse(
            snapshotId = snapshot.id,
            status = snapshot.status,
            format = request.format,
            downloadUrl = "/api/export/download/${snapshot.id}"
        )
    }

    /**
     * Get export file bytes by snapshot ID.
     */
    fun getExportFile(snapshotId: Long): Triple<ByteArray, String, String>? {
        val snapshot = snapshotRepo.findById(snapshotId).orElse(null) ?: return null
        val filePath = snapshot.filePath ?: return null
        val path = Paths.get(filePath)
        if (!Files.exists(path)) return null

        val contentType = when (snapshot.outputFormat) {
            OutputFormat.CSV -> "text/csv"
            OutputFormat.EXCEL -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            OutputFormat.PDF -> "application/pdf"
            else -> "application/octet-stream"
        }
        val ext = when (snapshot.outputFormat) {
            OutputFormat.CSV -> "csv"
            OutputFormat.EXCEL -> "xlsx"
            OutputFormat.PDF -> "pdf"
            else -> "json"
        }

        return Triple(Files.readAllBytes(path), "report_${snapshot.reportId}.$ext", contentType)
    }

    // ── CSV Export ──

    private fun exportCsv(
        reportName: String,
        widgets: List<RenderedWidget>,
        request: ExportRequest
    ): ByteArray {
        val sb = StringBuilder()

        for ((idx, widget) in widgets.withIndex()) {
            val data = widget.data ?: continue
            val cols = data.columns
            val rows = data.rows

            // Widget separator
            if (idx > 0) sb.appendLine()
            if (widgets.size > 1) {
                sb.appendLine("# ${widget.title ?: "Widget ${widget.widgetId}"}")
            }

            // Headers
            if (request.includeHeaders) {
                sb.appendLine(cols.joinToString(",") { escapeCsv(it) })
            }

            // Rows
            for (row in rows) {
                val values = cols.mapIndexed { colIdx, _ ->
                    val value = row.getOrNull(colIdx)
                    escapeCsv(value?.toString() ?: "")
                }
                sb.appendLine(values.joinToString(","))
            }
        }

        return sb.toString().toByteArray(Charsets.UTF_8)
    }

    // ── Excel Export ──

    private fun exportExcel(
        reportName: String,
        widgets: List<RenderedWidget>,
        request: ExportRequest
    ): ByteArray {
        val workbook = XSSFWorkbook()

        // Header style
        val headerStyle = workbook.createCellStyle().apply {
            val font = workbook.createFont().apply {
                bold = true
                fontHeightInPoints = 11
            }
            setFont(font)
        }

        if (request.sheetPerWidget && widgets.size > 1) {
            // One sheet per widget
            for (widget in widgets) {
                val data = widget.data ?: continue
                val sheetName = sanitizeSheetName(widget.title ?: "Widget ${widget.widgetId}")
                val sheet = workbook.createSheet(sheetName)
                writeWidgetToSheet(sheet, data, headerStyle, request.includeHeaders)
            }
        } else {
            // All in one sheet
            val sheet = workbook.createSheet(sanitizeSheetName(reportName))
            var rowOffset = 0
            for ((idx, widget) in widgets.withIndex()) {
                val data = widget.data ?: continue
                if (idx > 0) rowOffset++ // blank row separator

                // Widget title row
                if (widgets.size > 1) {
                    val titleRow = sheet.createRow(rowOffset++)
                    val cell = titleRow.createCell(0)
                    cell.setCellValue(widget.title ?: "Widget ${widget.widgetId}")
                    cell.cellStyle = headerStyle
                }

                rowOffset = writeWidgetToSheet(sheet, data, headerStyle, request.includeHeaders, rowOffset)
            }
        }

        val out = ByteArrayOutputStream()
        workbook.write(out)
        workbook.close()
        return out.toByteArray()
    }

    private fun writeWidgetToSheet(
        sheet: org.apache.poi.ss.usermodel.Sheet,
        data: WidgetData,
        headerStyle: org.apache.poi.ss.usermodel.CellStyle,
        includeHeaders: Boolean,
        startRow: Int = 0
    ): Int {
        var rowIdx = startRow

        // Headers
        if (includeHeaders) {
            val headerRow = sheet.createRow(rowIdx++)
            data.columns.forEachIndexed { colIdx, colName ->
                val cell = headerRow.createCell(colIdx)
                cell.setCellValue(colName)
                cell.cellStyle = headerStyle
            }
        }

        // Data rows
        for (row in data.rows) {
            val excelRow = sheet.createRow(rowIdx++)
            data.columns.forEachIndexed { colIdx, _ ->
                val cell = excelRow.createCell(colIdx)
                val value = row.getOrNull(colIdx)
                when (value) {
                    null -> cell.setBlank()
                    is Number -> cell.setCellValue(value.toDouble())
                    is Boolean -> cell.setCellValue(value)
                    else -> cell.setCellValue(value.toString())
                }
            }
        }

        // Auto-size columns
        for (i in data.columns.indices) {
            try { sheet.autoSizeColumn(i) } catch (_: Exception) {}
        }

        return rowIdx
    }

    // ── PDF Export ──

    private fun exportPdf(
        reportName: String,
        widgets: List<RenderedWidget>,
        request: ExportRequest
    ): ByteArray {
        // Generate HTML table representation, then convert to PDF-like format
        // Using simple HTML → byte array approach with a table-based layout
        val html = buildPdfHtml(reportName, widgets)

        // Since we want minimal dependencies, we generate a well-formatted HTML
        // that can be viewed directly. For true PDF, add openhtmltopdf to build.gradle.kts.
        // For now, we produce clean HTML exported as .pdf (many tools open it).
        // TODO: Replace with openhtmltopdf when dependency is added:
        //   val builder = PdfRendererBuilder()
        //   val out = ByteArrayOutputStream()
        //   builder.withHtmlContent(html, null)
        //   builder.toStream(out)
        //   builder.run()
        //   return out.toByteArray()

        return html.toByteArray(Charsets.UTF_8)
    }

    private fun buildPdfHtml(reportName: String, widgets: List<RenderedWidget>): String {
        val sb = StringBuilder()
        sb.appendLine("<!DOCTYPE html>")
        sb.appendLine("<html><head><meta charset='UTF-8'>")
        sb.appendLine("<title>$reportName</title>")
        sb.appendLine("<style>")
        sb.appendLine("body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #333; }")
        sb.appendLine("h1 { color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }")
        sb.appendLine("h2 { color: #475569; margin-top: 30px; }")
        sb.appendLine("table { border-collapse: collapse; width: 100%; margin: 10px 0 20px; }")
        sb.appendLine("th { background: #f1f5f9; color: #334155; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; }")
        sb.appendLine("td { padding: 6px 12px; border: 1px solid #e2e8f0; }")
        sb.appendLine("tr:nth-child(even) { background: #f8fafc; }")
        sb.appendLine(".meta { color: #94a3b8; font-size: 12px; margin-bottom: 20px; }")
        sb.appendLine(".widget-info { color: #64748b; font-size: 11px; }")
        sb.appendLine("@media print { body { margin: 20px; } }")
        sb.appendLine("</style></head><body>")
        sb.appendLine("<h1>$reportName</h1>")
        sb.appendLine("<p class='meta'>Exported: ${java.time.LocalDateTime.now().toString().replace('T', ' ').substringBefore('.')}</p>")

        for (widget in widgets) {
            val data = widget.data ?: continue
            sb.appendLine("<h2>${widget.title ?: "Data"}</h2>")
            sb.appendLine("<p class='widget-info'>${data.rowCount} rows · ${data.executionMs}ms</p>")
            sb.appendLine("<table>")

            // Header
            sb.appendLine("<thead><tr>")
            for (col in data.columns) {
                sb.appendLine("<th>${escapeHtml(col)}</th>")
            }
            sb.appendLine("</tr></thead>")

            // Rows
            sb.appendLine("<tbody>")
            for (row in data.rows) {
                sb.appendLine("<tr>")
                for ((colIdx, _) in data.columns.withIndex()) {
                    val value = row.getOrNull(colIdx)
                    sb.appendLine("<td>${escapeHtml(value?.toString() ?: "")}</td>")
                }
                sb.appendLine("</tr>")
            }
            sb.appendLine("</tbody></table>")
        }

        sb.appendLine("</body></html>")
        return sb.toString()
    }

    // ── Utilities ──

    private fun escapeCsv(value: String): String {
        return if (value.contains(',') || value.contains('"') || value.contains('\n')) {
            "\"${value.replace("\"", "\"\"")}\""
        } else value
    }

    private fun escapeHtml(value: String): String {
        return value.replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace("\"", "&quot;")
    }

    private fun sanitizeFilename(name: String): String {
        return name.replace(Regex("[^a-zA-Z0-9_\\-.]"), "_").take(100)
    }

    private fun sanitizeSheetName(name: String): String {
        return name.replace(Regex("[\\[\\]\\\\/*?:]"), "_").take(31)
    }
}
