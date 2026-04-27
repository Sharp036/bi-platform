package com.datorio.service

import com.datorio.model.OutputFormat
import com.datorio.model.WidgetType
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
        // Prefer a client-supplied snapshot (what's currently on screen).
        // Fall back to a full re-render if the snapshot is absent.
        val (reportName, widgets) = if (request.snapshot != null) {
            val snap = request.snapshot
            val mapped = snap.widgets.map { ws ->
                RenderedWidget(
                    widgetId = ws.widgetId,
                    widgetType = WidgetType.TABLE,
                    title = ws.title,
                    chartConfig = "",
                    position = "",
                    style = "",
                    data = WidgetData(
                        columns = ws.columns,
                        rows = ws.rows,
                        rowCount = ws.rows.size,
                        executionMs = 0L
                    ),
                    error = null
                )
            }
            snap.reportName to mapped
        } else {
            val renderResult = renderService.renderReport(
                reportId, RenderReportRequest(request.parameters), username
            )
            val filtered = if (request.widgetIds != null) {
                renderResult.widgets.filter { it.widgetId in request.widgetIds }
            } else {
                renderResult.widgets
            }.filter { it.data != null }
            renderResult.reportName to filtered
        }

        return when (request.format.uppercase()) {
            "CSV" -> exportCsv(reportName, widgets, request) to
                "${sanitizeFilename(reportName)}.csv"
            "EXCEL", "XLSX" -> exportExcel(reportName, widgets, request) to
                "${sanitizeFilename(reportName)}.xlsx"
            "PDF" -> throw IllegalArgumentException(
                "PDF export is generated client-side (html2canvas + jsPDF); this endpoint only handles CSV/EXCEL"
            )
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
                val values = cols.map { col ->
                    val value = row[col]
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
            data.columns.forEachIndexed { colIdx, col ->
                val cell = excelRow.createCell(colIdx)
                val value = row[col]
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

    // ── Utilities ──

    private fun escapeCsv(value: String): String {
        return if (value.contains(',') || value.contains('"') || value.contains('\n')) {
            "\"${value.replace("\"", "\"\"")}\""
        } else value
    }

    private fun sanitizeFilename(name: String): String {
        return name.replace(Regex("[^a-zA-Z0-9_\\-.]"), "_").take(100)
    }

    private fun sanitizeSheetName(name: String): String {
        return name.replace(Regex("[\\[\\]\\\\/*?:]"), "_").take(31)
    }
}
