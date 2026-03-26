package com.datorio.service

import com.datorio.datasource.ConnectionManager
import com.datorio.model.*
import com.datorio.model.dto.*
import com.datorio.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.commons.csv.CSVFormat
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.ss.usermodel.DateUtil
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.nio.charset.Charset
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.zip.ZipInputStream

private const val MAX_ERRORS_STORED = 100
private const val BATCH_SIZE = 500
private const val PREVIEW_ROWS = 5
private const val MAX_ZIP_UNCOMPRESSED_BYTES = 500L * 1024 * 1024  // 500 MB

@Service
class ImportService(
    private val sourceRepo: ImportSourceRepository,
    private val logRepo: ImportLogRepository,
    private val errorRepo: ImportLogErrorRepository,
    private val datasourceRepo: DataSourceRepository,
    private val userRepo: UserRepository,
    private val connectionManager: ConnectionManager,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val jsonMapper = ObjectMapper()
    private val dataFormatter = org.apache.poi.ss.usermodel.DataFormatter()

    // ── Source CRUD ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    fun findAll(username: String = "", canSeeAll: Boolean = true): List<ImportSourceResponse> {
        if (canSeeAll) return sourceRepo.findAll().map { it.toResponse() }
        val user = userRepo.findByUsername(username).orElse(null) ?: return emptyList()
        val roleIds = user.roles.map { it.id }.ifEmpty { listOf(-1L) }
        return sourceRepo.findAccessibleSources(user.id, roleIds).map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun findById(id: Long): ImportSourceResponse =
        sourceRepo.findById(id).orElseThrow { NoSuchElementException("Import source $id not found") }.toResponse()

    @Transactional
    fun create(req: ImportSourceRequest, username: String): ImportSourceResponse {
        val ds = datasourceRepo.findById(req.datasourceId)
            .orElseThrow { NoSuchElementException("DataSource ${req.datasourceId} not found") }
        val user = userRepo.findByUsername(username).orElse(null)
        val source = ImportSource(
            name = req.name,
            description = req.description,
            datasource = ds,
            sourceFormat = req.sourceFormat,
            sheetName = req.sheetName,
            headerRow = req.headerRow,
            skipRows = req.skipRows,
            targetSchema = req.targetSchema,
            targetTable = req.targetTable,
            loadMode = req.loadMode,
            keyColumns = req.keyColumns?.toTypedArray(),
            filenamePattern = req.filenamePattern,
            strictColumns = req.strictColumns,
            forbiddenColumns = req.forbiddenColumns?.toTypedArray(),
            fileEncoding = req.fileEncoding.ifBlank { "UTF-8" },
            jsonArrayPath = req.jsonArrayPath?.trim()?.ifEmpty { null },
            createdBy = user,
        )
        req.mappings.forEach { m ->
            source.mappings.add(ImportSourceMapping(
                source = source,
                sourceColumn = m.sourceColumn,
                targetColumn = m.targetColumn,
                dataType = m.dataType,
                nullable = m.nullable,
                dateFormat = m.dateFormat,
                constValue = m.constValue,
            ))
        }
        return sourceRepo.save(source).toResponse()
    }

    @Transactional
    fun update(id: Long, req: ImportSourceRequest): ImportSourceResponse {
        val source = sourceRepo.findById(id)
            .orElseThrow { NoSuchElementException("Import source $id not found") }
        val ds = datasourceRepo.findById(req.datasourceId)
            .orElseThrow { NoSuchElementException("DataSource ${req.datasourceId} not found") }
        source.name = req.name
        source.description = req.description
        source.datasource = ds
        source.sourceFormat = req.sourceFormat
        source.sheetName = req.sheetName
        source.headerRow = req.headerRow
        source.skipRows = req.skipRows
        source.targetSchema = req.targetSchema
        source.targetTable = req.targetTable
        source.loadMode = req.loadMode
        source.keyColumns = req.keyColumns?.toTypedArray()
        source.filenamePattern = req.filenamePattern
        source.strictColumns = req.strictColumns
        source.forbiddenColumns = req.forbiddenColumns?.toTypedArray()
        source.fileEncoding = req.fileEncoding.ifBlank { "UTF-8" }
        source.jsonArrayPath = req.jsonArrayPath?.trim()?.ifEmpty { null }
        source.updatedAt = java.time.OffsetDateTime.now()
        source.mappings.clear()
        req.mappings.forEach { m ->
            source.mappings.add(ImportSourceMapping(
                source = source,
                sourceColumn = m.sourceColumn,
                targetColumn = m.targetColumn,
                dataType = m.dataType,
                nullable = m.nullable,
                dateFormat = m.dateFormat,
                constValue = m.constValue,
            ))
        }
        return sourceRepo.save(source).toResponse()
    }

    @Transactional
    fun delete(id: Long) {
        if (!sourceRepo.existsById(id)) throw NoSuchElementException("Import source $id not found")
        sourceRepo.deleteById(id)
    }

    // ── Preview ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    fun preview(id: Long, file: MultipartFile): ImportPreviewResponse {
        val source = sourceRepo.findById(id)
            .orElseThrow { NoSuchElementException("Import source $id not found") }
        val filename = file.originalFilename ?: file.name
        val rows = parseFile(file.inputStream, filename, source, maxRows = PREVIEW_ROWS)
            .map { applyConstValues(it, source.mappings, filename) }
        val columns = if (rows.isNotEmpty()) rows[0].keys.toList() else emptyList()
        val data = rows.map { row -> columns.map { col -> row[col] } }
        return ImportPreviewResponse(columns = columns, rows = data)
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    @Transactional
    fun upload(id: Long, file: MultipartFile, username: String): ImportUploadResult {
        val source = sourceRepo.findById(id)
            .orElseThrow { NoSuchElementException("Import source $id not found") }
        val user = userRepo.findByUsername(username).orElse(null)

        val filename = if (source.sourceFormat == "api") source.name
                      else (file.originalFilename ?: file.name)

        val importLog = logRepo.save(ImportLog(
            source = source,
            filename = filename,
            uploadedBy = user,
            status = "validating",
        ))

        return try {
            val rows = parseFile(file.inputStream, filename, source)
                .map { applyConstValues(it, source.mappings, filename) }
            importLog.rowsTotal = rows.size

            val headerErrors = validateFileHeaders(rows, source)
            if (headerErrors.isNotEmpty()) {
                importLog.rowsImported = 0
                importLog.rowsFailed = rows.size
                importLog.status = "error"
                importLog.errorDetail = headerErrors.first().errorMessage
                logRepo.save(importLog)
                return ImportUploadResult(
                    logId = importLog.id,
                    rowsTotal = rows.size,
                    rowsImported = 0,
                    rowsFailed = rows.size,
                    status = "error",
                    errors = headerErrors,
                )
            }

            val errors = validateRows(rows, source.mappings)
            val savedErrors = mutableListOf<ImportLogError>()
            errors.take(MAX_ERRORS_STORED).forEach { e ->
                savedErrors.add(errorRepo.save(ImportLogError(
                    log = importLog,
                    rowNumber = e.rowNumber,
                    columnName = e.columnName,
                    errorMessage = e.errorMessage,
                )))
            }

            if (errors.isNotEmpty()) {
                importLog.rowsImported = 0
                importLog.rowsFailed = errors.size
                importLog.status = "error"
                importLog.errorDetail = "Validation failed: ${errors.size} row(s) with errors"
                logRepo.save(importLog)
                return ImportUploadResult(
                    logId = importLog.id,
                    rowsTotal = rows.size,
                    rowsImported = 0,
                    rowsFailed = errors.size,
                    status = "error",
                    errors = errors.take(MAX_ERRORS_STORED),
                )
            }

            importLog.status = "importing"
            logRepo.save(importLog)

            val (imported, failed) = writeToDatabase(rows, source)
            importLog.rowsImported = imported
            importLog.rowsFailed = failed
            importLog.status = if (failed == 0) "success" else "error"
            if (failed > 0) importLog.errorDetail = "$failed row(s) failed during insert"
            logRepo.save(importLog)

            ImportUploadResult(
                logId = importLog.id,
                rowsTotal = rows.size,
                rowsImported = imported,
                rowsFailed = failed,
                status = importLog.status,
                errors = emptyList(),
            )
        } catch (e: Exception) {
            log.error("Import failed for source $id: ${e.message}", e)
            importLog.status = "error"
            importLog.errorDetail = e.message
            logRepo.save(importLog)
            ImportUploadResult(
                logId = importLog.id,
                rowsTotal = importLog.rowsTotal ?: 0,
                rowsImported = 0,
                rowsFailed = importLog.rowsTotal ?: 0,
                status = "error",
                errors = listOf(ImportErrorDetail(0, null, e.message ?: "Unknown error")),
            )
        }
    }

    // ── Logs ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    fun getLogs(username: String, showAll: Boolean): List<ImportLogResponse> {
        val logs = if (showAll) logRepo.findAllByOrderByUploadedAtDesc()
                   else logRepo.findAllByUploadedByUsernameOrderByUploadedAtDesc(username)
        return logs.map { it.toResponse() }
    }

    fun getErrors(logId: Long): List<ImportErrorDetail> =
        errorRepo.findAllByLogId(logId).map {
            ImportErrorDetail(it.rowNumber, it.columnName, it.errorMessage)
        }

    // ── Constant value injection ──────────────────────────────────────────────

    private fun applyConstValues(
        row: Map<String, String?>,
        mappings: List<ImportSourceMapping>,
        filename: String,
    ): Map<String, String?> {
        val today = java.time.LocalDate.now().toString()  // yyyy-MM-dd
        val constMappings = mappings.filter { !it.constValue.isNullOrEmpty() }
        if (constMappings.isEmpty()) return row
        val result = row.toMutableMap()
        constMappings.forEach { m ->
            val value = m.constValue!!
                .replace("{filename}", filename)
                .replace("{today}", today)
            // Use targetColumn as the key for const mappings: sourceColumn is empty/null
            // for const values, so using it would cause collisions when multiple mappings
            // have no source column. targetColumn is always unique (it's the DB column name).
            result[m.targetColumn] = value
        }
        return result
    }

    // ── File parsing ──────────────────────────────────────────────────────────

    private fun parseFile(
        stream: InputStream,
        filename: String,
        source: ImportSource,
        maxRows: Int = Int.MAX_VALUE,
    ): List<Map<String, String?>> = when (source.sourceFormat) {
        "zip"  -> parseZip(stream, source, maxRows)
        "tsv"  -> parseCsvWithCommons(stream, source, maxRows, '\t')
        "json" -> parseJson(stream, source, maxRows)
        "csv"  -> parseCsvWithCommons(stream, source, maxRows, null)
        else   -> parseXlsx(stream, source, maxRows)  // 'xlsx' and 'api' both use XLSX parsing
    }

    // ── ZIP ──────────────────────────────────────────────────────────────────

    private fun parseZip(stream: InputStream, source: ImportSource, maxRows: Int): List<Map<String, String?>> {
        val pattern = source.filenamePattern?.trim()?.takeIf { it.isNotEmpty() }
        val allRows = mutableListOf<Map<String, String?>>()
        var totalUncompressed = 0L

        // Use ISO-8859-1 for reading ZIP entry names: it maps all 256 byte values without
        // throwing, so ZIPs created on Windows with CP866/CP1251 Cyrillic filenames are handled
        // correctly. File extensions are always ASCII so format detection still works.
        ZipInputStream(stream, Charsets.ISO_8859_1).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) {
                    val entryName = entry.name
                    val lower = entryName.lowercase()
                    val matchesFormat = lower.endsWith(".xlsx") || lower.endsWith(".csv") ||
                            lower.endsWith(".tsv") || lower.endsWith(".json")
                    val matchesPattern = pattern == null || matchesGlob(entryName, pattern)

                    if (matchesFormat && matchesPattern) {
                        val bytes = readBytesLimited(zip, MAX_ZIP_UNCOMPRESSED_BYTES - totalUncompressed)
                        totalUncompressed += bytes.size
                        val rows = parseByExtension(bytes.inputStream(), entryName, source, maxRows - allRows.size)
                        allRows.addAll(rows)
                        if (allRows.size >= maxRows) break
                    }
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }

        if (allRows.isEmpty()) throw IllegalArgumentException("No matching files found in ZIP archive")
        return allRows
    }

    private fun parseByExtension(stream: InputStream, filename: String, source: ImportSource, maxRows: Int): List<Map<String, String?>> {
        val lower = filename.lowercase()
        return when {
            lower.endsWith(".xlsx") -> parseXlsx(stream, source, maxRows)
            lower.endsWith(".tsv")  -> parseCsvWithCommons(stream, source, maxRows, '\t')
            lower.endsWith(".json") -> parseJson(stream, source, maxRows)
            else                    -> parseCsvWithCommons(stream, source, maxRows, null)
        }
    }

    private fun readBytesLimited(stream: InputStream, limit: Long): ByteArray {
        val buffer = ByteArrayOutputStream()
        val chunk = ByteArray(8192)
        var total = 0L
        var read: Int
        while (stream.read(chunk).also { read = it } != -1) {
            total += read
            if (total > limit) throw IllegalArgumentException("ZIP contents exceed 500 MB size limit")
            buffer.write(chunk, 0, read)
        }
        return buffer.toByteArray()
    }

    private fun matchesGlob(name: String, pattern: String): Boolean {
        val regex = buildString {
            pattern.forEach { ch ->
                when (ch) {
                    '*'  -> append(".*")
                    '?'  -> append(".")
                    '.'  -> append("\\.")
                    '\\' -> append("\\\\")
                    else -> append(Regex.escape(ch.toString()))
                }
            }
        }
        return name.matches(Regex(regex, RegexOption.IGNORE_CASE))
    }

    // ── XLSX ─────────────────────────────────────────────────────────────────

    private fun parseXlsx(stream: InputStream, source: ImportSource, maxRows: Int): List<Map<String, String?>> {
        val workbook = XSSFWorkbook(stream)
        val sheet = if (source.sheetName != null)
            workbook.getSheet(source.sheetName) ?: workbook.getSheetAt(0)
        else
            workbook.getSheetAt(0)

        val headerRowIdx = source.headerRow - 1

        // Collect pre-header cells (e.g. A1 = date) as synthetic columns.
        // All non-empty cells in rows before the header are exposed by cell address
        // (A1, B2, etc.) so they can be referenced in mappings via sourceColumn="A1".
        val preHeaderContext = mutableMapOf<String, String>()
        for (rIdx in 0 until headerRowIdx) {
            val row = sheet.getRow(rIdx) ?: continue
            for (cIdx in 0 until row.lastCellNum) {
                val value = cellToString(row.getCell(cIdx))?.takeIf { it.isNotEmpty() } ?: continue
                preHeaderContext["${columnIndexToLetter(cIdx)}${rIdx + 1}"] = value
            }
        }

        val headerRow = sheet.getRow(headerRowIdx)
            ?: throw IllegalArgumentException("Header row ${source.headerRow} not found in sheet")

        val headers = (0 until headerRow.lastCellNum).map { i ->
            headerRow.getCell(i)?.toString()?.trim() ?: ""
        }

        val result = mutableListOf<Map<String, String?>>()
        val firstDataRow = headerRowIdx + 1 + source.skipRows

        for (rowIdx in firstDataRow..sheet.lastRowNum) {
            if (result.size >= maxRows) break
            val row = sheet.getRow(rowIdx) ?: continue
            val map = mutableMapOf<String, String?>()
            map.putAll(preHeaderContext)
            headers.forEachIndexed { i, header ->
                if (header.isNotEmpty()) {
                    val cell = row.getCell(i)
                    map[header] = cellToString(cell)
                }
            }
            result.add(map)
        }
        workbook.close()
        return result
    }

    private fun columnIndexToLetter(index: Int): String {
        var idx = index
        val sb = StringBuilder()
        do {
            sb.insert(0, 'A' + idx % 26)
            idx = idx / 26 - 1
        } while (idx >= 0)
        return sb.toString()
    }

    private fun cellToString(cell: org.apache.poi.ss.usermodel.Cell?): String? {
        if (cell == null) return null
        return when (cell.cellType) {
            CellType.BLANK -> null
            CellType.BOOLEAN -> cell.booleanCellValue.toString()
            CellType.NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    cell.localDateTimeCellValue.toLocalDate().toString()
                } else {
                    dataFormatter.formatCellValue(cell).trim().ifEmpty { null }
                }
            }
            CellType.FORMULA -> {
                try { dataFormatter.formatCellValue(cell).trim().ifEmpty { null } }
                catch (_: Exception) { cell.stringCellValue?.trim()?.ifEmpty { null } }
            }
            else -> cell.stringCellValue?.trim()?.ifEmpty { null }
        }
    }

    // ── CSV / TSV (Apache Commons CSV) ────────────────────────────────────────

    private fun parseCsvWithCommons(
        stream: InputStream,
        source: ImportSource,
        maxRows: Int,
        fixedDelimiter: Char?,
    ): List<Map<String, String?>> {
        val charset = runCatching { Charset.forName(source.fileEncoding) }.getOrDefault(Charsets.UTF_8)
        val allLines = stream.bufferedReader(charset).readLines()
        if (allLines.isEmpty()) return emptyList()

        val headerLineIdx = source.headerRow - 1
        if (headerLineIdx >= allLines.size) throw IllegalArgumentException("Header row ${source.headerRow} not found")

        val headerLine = allLines[headerLineIdx]
        val delimiter = fixedDelimiter ?: when {
            headerLine.contains('\t') -> '\t'
            headerLine.contains(';')  -> ';'
            else                      -> ','
        }

        val dataLines = allLines.drop(headerLineIdx + 1 + source.skipRows)
        if (dataLines.isEmpty()) return emptyList()

        val csvContent = (listOf(headerLine) + dataLines).joinToString("\n")
        val csvFormat = CSVFormat.DEFAULT.builder()
            .setDelimiter(delimiter)
            .setHeader()
            .setSkipHeaderRecord(true)
            .setIgnoreSurroundingSpaces(true)
            .setIgnoreEmptyLines(true)
            .setNullString("")
            .build()

        val result = mutableListOf<Map<String, String?>>()
        csvFormat.parse(csvContent.reader()).use { parser ->
            for (record in parser) {
                if (result.size >= maxRows) break
                val map = mutableMapOf<String, String?>()
                parser.headerNames.forEach { h ->
                    if (h.isNotEmpty()) map[h] = record.get(h)?.trim()?.ifEmpty { null }
                }
                result.add(map)
            }
        }
        return result
    }

    // ── JSON ──────────────────────────────────────────────────────────────────

    private fun parseJson(stream: InputStream, source: ImportSource, maxRows: Int): List<Map<String, String?>> {
        // Jackson auto-detects JSON encoding (UTF-8/UTF-16/UTF-32, with or without BOM).
        // Using raw stream instead of charset-decoded Reader avoids MalformedInputException
        // when the file has a UTF-16 BOM or any non-UTF-8 Unicode encoding.
        val rootNode = jsonMapper.readTree(stream)

        val path = source.jsonArrayPath?.trim()?.takeIf { it.isNotEmpty() }

        if (path != null) {
            // Extract root-level scalar fields (strings, numbers, booleans) and inject
            // them into every row so mappings like sourceColumn="date" work for fields
            // that sit at the JSON root rather than inside the nested array.
            val rootContext = mutableMapOf<String, String>()
            rootNode.fields().forEach { (k, v) ->
                if (v.isValueNode && !v.isNull) rootContext[k] = v.asText().trim()
            }

            // Navigate to nested array using dot-path with * wildcards.
            // Example: "clusters.*.group_ax.*.brand.*"
            // Each * iterates all keys of that object level and adds the key
            // as a column named after the preceding path element.
            val parts = path.split(".")
            val result = mutableListOf<Map<String, String?>>()
            collectJsonPath(rootNode, parts, 0, rootContext, result, source, maxRows)
            return result
        }

        // No path: root must be an array
        if (!rootNode.isArray) throw IllegalArgumentException(
            "JSON root must be an array. For nested JSON specify 'JSON array path' (e.g. clusters.*.group_ax.*.brand.*)"
        )
        return parseJsonArray(rootNode, source, maxRows)
    }

    private fun collectJsonPath(
        node: com.fasterxml.jackson.databind.JsonNode,
        parts: List<String>,
        idx: Int,
        context: Map<String, String>,
        result: MutableList<Map<String, String?>>,
        source: ImportSource,
        maxRows: Int,
    ) {
        if (result.size >= maxRows) return

        if (idx >= parts.size) {
            // Reached target node — should be an array of objects
            if (node.isArray) {
                for (elem in node) {
                    if (result.size >= maxRows) break
                    if (!elem.isObject) continue
                    val map = mutableMapOf<String, String?>()
                    map.putAll(context)
                    elem.fields().forEach { (k, v) ->
                        map[k] = if (v.isNull || v.isMissingNode) null else v.asText().trim().ifEmpty { null }
                    }
                    result.add(map)
                }
            }
            return
        }

        val part = parts[idx]
        if (part == "*") {
            // Iterate all keys; column name = previous path part
            val colName = if (idx > 0) parts[idx - 1] else "key"
            node.fields().forEach { (key, child) ->
                collectJsonPath(child, parts, idx + 1, context + (colName to key), result, source, maxRows)
            }
        } else {
            val child = node.get(part) ?: return
            collectJsonPath(child, parts, idx + 1, context, result, source, maxRows)
        }
    }

    private fun parseJsonArray(
        rootNode: com.fasterxml.jackson.databind.JsonNode,
        source: ImportSource,
        maxRows: Int,
    ): List<Map<String, String?>> {
        if (rootNode.size() == 0) return emptyList()
        val firstElem = rootNode.get(source.skipRows) ?: return emptyList()
        val result = mutableListOf<Map<String, String?>>()

        if (firstElem.isObject) {
            for (i in source.skipRows until rootNode.size()) {
                if (result.size >= maxRows) break
                val elem = rootNode.get(i)
                if (!elem.isObject) continue
                val map = mutableMapOf<String, String?>()
                elem.fields().forEach { (k, v) ->
                    map[k] = if (v.isNull || v.isMissingNode) null else v.asText().trim().ifEmpty { null }
                }
                result.add(map)
            }
        } else if (firstElem.isArray) {
            val headerIdx = source.headerRow - 1
            if (headerIdx >= rootNode.size()) throw IllegalArgumentException("Header row ${source.headerRow} not found in JSON")
            val headers = rootNode.get(headerIdx).map { it.asText().trim() }
            val dataStart = headerIdx + 1 + source.skipRows
            for (i in dataStart until rootNode.size()) {
                if (result.size >= maxRows) break
                val elem = rootNode.get(i)
                if (!elem.isArray) continue
                val map = mutableMapOf<String, String?>()
                headers.forEachIndexed { ci, h ->
                    if (h.isNotEmpty()) {
                        val v = elem.get(ci)
                        map[h] = if (v == null || v.isNull) null else v.asText().trim().ifEmpty { null }
                    }
                }
                result.add(map)
            }
        } else {
            throw IllegalArgumentException("JSON array elements must be objects or arrays")
        }
        return result
    }

    // ── Validation ────────────────────────────────────────────────────────────

    // Cell-address keys injected by pre-header context (e.g. "A1", "BC12") are
    // not real file columns and must be excluded from header checks.
    private val cellAddressRegex = Regex("^[A-Z]+\\d+$")

    private fun validateFileHeaders(
        rows: List<Map<String, String?>>,
        source: ImportSource,
    ): List<ImportErrorDetail> {
        if (rows.isEmpty()) return emptyList()
        val errors = mutableListOf<ImportErrorDetail>()

        val fileColumns = rows.first().keys
            .filter { !cellAddressRegex.matches(it) }
            .toSet()

        val forbidden = source.forbiddenColumns
        if (!forbidden.isNullOrEmpty()) {
            val found = fileColumns.intersect(forbidden.toSet())
            if (found.isNotEmpty()) {
                errors.add(ImportErrorDetail(0, null,
                    "File contains forbidden column(s): ${found.sorted().joinToString(", ")}"))
            }
        }

        if (source.strictColumns) {
            val mappedColumns = source.mappings
                .mapNotNull { it.sourceColumn }
                .filter { it.isNotBlank() && !cellAddressRegex.matches(it) }
                .toSet()
            val unmapped = fileColumns - mappedColumns
            if (unmapped.isNotEmpty()) {
                errors.add(ImportErrorDetail(0, null,
                    "File contains unmapped column(s): ${unmapped.sorted().joinToString(", ")}"))
            }
        }

        return errors
    }

    private fun validateRows(
        rows: List<Map<String, String?>>,
        mappings: List<ImportSourceMapping>,
    ): List<ImportErrorDetail> {
        val errors = mutableListOf<ImportErrorDetail>()

        rows.forEachIndexed { rowIdx, row ->
            if (errors.size >= MAX_ERRORS_STORED) return errors
            val rowNumber = rowIdx + 1
            mappings.forEach { m ->
                // Const-value mappings store their value under targetColumn (see applyConstValues).
                val rowKey = if (!m.constValue.isNullOrEmpty()) m.targetColumn else m.sourceColumn ?: m.targetColumn
                val value = row[rowKey]
                if (value == null || value.isBlank()) {
                    if (!m.nullable) {
                        errors.add(ImportErrorDetail(rowNumber, m.sourceColumn, "Required value is missing"))
                    }
                    return@forEach
                }
                val parseError = when (m.dataType) {
                    "integer" -> if (value.toLongOrNull() == null) "Cannot parse '$value' as integer" else null
                    "float" -> if (value.replace(',', '.').toDoubleOrNull() == null) "Cannot parse '$value' as float" else null
                    "boolean" -> if (value.lowercase() !in setOf("true", "false", "1", "0", "yes", "no")) "Cannot parse '$value' as boolean" else null
                    "date" -> {
                        val fmt = m.dateFormat ?: "yyyy-MM-dd"
                        try { LocalDate.parse(value, DateTimeFormatter.ofPattern(fmt)); null }
                        catch (_: Exception) { "Cannot parse '$value' as date with format '$fmt'" }
                    }
                    "datetime" -> {
                        val fmt = m.dateFormat ?: "yyyy-MM-dd HH:mm:ss"
                        try { LocalDateTime.parse(value, DateTimeFormatter.ofPattern(fmt)); null }
                        catch (_: Exception) { "Cannot parse '$value' as datetime with format '$fmt'" }
                    }
                    else -> null
                }
                if (parseError != null) {
                    errors.add(ImportErrorDetail(rowNumber, m.targetColumn, parseError))
                }
            }
        }
        return errors
    }

    // ── Database write ────────────────────────────────────────────────────────

    private fun writeToDatabase(
        rows: List<Map<String, String?>>,
        source: ImportSource,
    ): Pair<Int, Int> {
        val ds = source.datasource
        val pool = connectionManager.getPool(ds)
        val mappings = source.mappings
        val schemaTable = "${source.targetSchema}.${source.targetTable}"
        val cols = mappings.map { it.targetColumn }
        val placeholders = cols.joinToString(", ") { "?" }
        val colList = cols.joinToString(", ")

        val insertSql = buildInsertSql(schemaTable, colList, placeholders, source, ds.type.name)

        pool.connection.use { conn ->
            conn.autoCommit = false
            try {
                if (source.loadMode == "replace") {
                    val truncateSql = if (ds.type.name == "CLICKHOUSE")
                        "TRUNCATE TABLE $schemaTable"
                    else
                        "DELETE FROM $schemaTable"
                    conn.createStatement().use { it.execute(truncateSql) }
                }

                conn.prepareStatement(insertSql).use { ps ->
                    var imported = 0
                    var failed = 0
                    rows.forEachIndexed { rowIdx, row ->
                        try {
                            mappings.forEachIndexed { i, m ->
                                // Const-value mappings are stored under targetColumn in the row map.
                                val raw = row[if (!m.constValue.isNullOrEmpty()) m.targetColumn else m.sourceColumn ?: m.targetColumn]
                                setParam(ps, i + 1, raw, m)
                            }
                            ps.addBatch()
                            if ((rowIdx + 1) % BATCH_SIZE == 0) {
                                ps.executeBatch()
                                imported += BATCH_SIZE
                            }
                        } catch (e: Exception) {
                            log.warn("Row ${rowIdx + 1} failed: ${e.message}")
                            failed++
                        }
                    }
                    val remaining = rows.size % BATCH_SIZE
                    if (remaining > 0) {
                        ps.executeBatch()
                        imported += remaining
                    }
                    conn.commit()
                    return Pair(imported - failed, failed)
                }
            } catch (e: Exception) {
                conn.rollback()
                throw e
            }
        }
    }

    private fun buildInsertSql(
        schemaTable: String,
        colList: String,
        placeholders: String,
        source: ImportSource,
        dbType: String,
    ): String {
        val base = "INSERT INTO $schemaTable ($colList) VALUES ($placeholders)"
        if (source.loadMode != "upsert") return base
        if (dbType == "CLICKHOUSE") return base  // ReplacingMergeTree handles dedup
        val keyCols = source.keyColumns ?: return base
        val updateClauses = source.mappings
            .filter { it.targetColumn !in keyCols }
            .joinToString(", ") { "${it.targetColumn} = EXCLUDED.${it.targetColumn}" }
        val conflictTarget = keyCols.joinToString(", ")
        return if (updateClauses.isNotEmpty())
            "$base ON CONFLICT ($conflictTarget) DO UPDATE SET $updateClauses"
        else
            "$base ON CONFLICT ($conflictTarget) DO NOTHING"
    }

    private fun setParam(ps: java.sql.PreparedStatement, idx: Int, raw: String?, mapping: ImportSourceMapping) {
        if (raw == null || raw.isBlank()) {
            ps.setNull(idx, java.sql.Types.VARCHAR)
            return
        }
        when (mapping.dataType) {
            "integer" -> ps.setLong(idx, raw.toLong())
            "float" -> ps.setDouble(idx, raw.replace(',', '.').toDouble())
            "boolean" -> ps.setBoolean(idx, raw.lowercase() in setOf("true", "1", "yes"))
            "date" -> {
                val fmt = mapping.dateFormat ?: "yyyy-MM-dd"
                val ld = LocalDate.parse(raw, DateTimeFormatter.ofPattern(fmt))
                // Use setObject with LocalDate to avoid java.sql.Date timezone conversion.
                // Date.valueOf(ld) creates midnight in JVM default timezone which JDBC then
                // converts to UTC epoch, potentially shifting the date by +-1 day.
                ps.setObject(idx, ld)
            }
            "datetime" -> {
                val fmt = mapping.dateFormat ?: "yyyy-MM-dd HH:mm:ss"
                val ldt = LocalDateTime.parse(raw, DateTimeFormatter.ofPattern(fmt))
                ps.setObject(idx, ldt)
            }
            else -> ps.setString(idx, raw)
        }
    }

    // ── Converters ────────────────────────────────────────────────────────────

    private fun ImportSource.toResponse() = ImportSourceResponse(
        id = id,
        name = name,
        description = description,
        datasourceId = datasource.id,
        datasourceName = datasource.name,
        sourceFormat = sourceFormat,
        sheetName = sheetName,
        headerRow = headerRow,
        skipRows = skipRows,
        targetSchema = targetSchema,
        targetTable = targetTable,
        loadMode = loadMode,
        keyColumns = keyColumns?.toList(),
        filenamePattern = filenamePattern,
        strictColumns = strictColumns,
        forbiddenColumns = forbiddenColumns?.toList(),
        fileEncoding = fileEncoding,
        jsonArrayPath = jsonArrayPath,
        mappings = mappings.map { m ->
            ImportSourceMappingResponse(m.id, m.sourceColumn, m.targetColumn, m.dataType, m.nullable, m.dateFormat, m.constValue)
        },
        createdAt = createdAt.toString(),
    )

    private fun ImportLog.toResponse() = ImportLogResponse(
        id = id,
        sourceId = source.id,
        sourceName = source.name,
        filename = filename,
        uploadedBy = uploadedBy?.username,
        uploadedAt = uploadedAt.toString(),
        rowsTotal = rowsTotal,
        rowsImported = rowsImported,
        rowsFailed = rowsFailed,
        status = status,
        errorDetail = errorDetail,
    )
}
