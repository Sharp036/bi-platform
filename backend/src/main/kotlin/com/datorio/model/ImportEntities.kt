package com.datorio.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.OffsetDateTime

@Entity
@Table(name = "import_source")
data class ImportSource(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 255)
    var name: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "datasource_id", nullable = false)
    var datasource: DataSource,

    @Column(name = "source_format", nullable = false, length = 10)
    var sourceFormat: String,

    @Column(name = "sheet_name", length = 255)
    var sheetName: String? = null,

    @Column(name = "header_row", nullable = false)
    var headerRow: Int = 1,

    @Column(name = "skip_rows", nullable = false)
    var skipRows: Int = 0,

    @Column(name = "target_schema", nullable = false, length = 255)
    var targetSchema: String,

    @Column(name = "target_table", nullable = false, length = 255)
    var targetTable: String,

    @Column(name = "load_mode", nullable = false, length = 10)
    var loadMode: String = "append",

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "key_columns", columnDefinition = "TEXT[]")
    var keyColumns: Array<String>? = null,

    @Column(name = "filename_pattern", length = 255)
    var filenamePattern: String? = null,

    @Column(name = "file_encoding", nullable = false, length = 20)
    var fileEncoding: String = "UTF-8",

    @Column(name = "json_array_path", length = 500)
    var jsonArrayPath: String? = null,

    @OneToMany(mappedBy = "source", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderBy("id ASC")
    var mappings: MutableList<ImportSourceMapping> = mutableListOf(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    val createdBy: User? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now()
) {
    override fun equals(other: Any?): Boolean = other is ImportSource && id == other.id
    override fun hashCode(): Int = id.hashCode()
}

@Entity
@Table(name = "import_source_mapping")
data class ImportSourceMapping(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_id", nullable = false)
    var source: ImportSource,

    @Column(name = "source_column", nullable = false, length = 255)
    var sourceColumn: String,

    @Column(name = "target_column", nullable = false, length = 255)
    var targetColumn: String,

    @Column(name = "data_type", nullable = false, length = 20)
    var dataType: String,

    @Column(nullable = false)
    var nullable: Boolean = true,

    @Column(name = "date_format", length = 50)
    var dateFormat: String? = null
) {
    override fun equals(other: Any?): Boolean = other is ImportSourceMapping && id == other.id
    override fun hashCode(): Int = id.hashCode()
}

@Entity
@Table(name = "import_log")
data class ImportLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_id", nullable = false)
    val source: ImportSource,

    @Column(nullable = false, length = 255)
    val filename: String,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    val uploadedBy: User? = null,

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    val uploadedAt: OffsetDateTime = OffsetDateTime.now(),

    @Column(name = "rows_total")
    var rowsTotal: Int? = null,

    @Column(name = "rows_imported")
    var rowsImported: Int? = null,

    @Column(name = "rows_failed")
    var rowsFailed: Int? = null,

    @Column(nullable = false, length = 15)
    var status: String = "validating",

    @Column(name = "error_detail", columnDefinition = "TEXT")
    var errorDetail: String? = null
) {
    override fun equals(other: Any?): Boolean = other is ImportLog && id == other.id
    override fun hashCode(): Int = id.hashCode()
}

@Entity
@Table(name = "import_log_error")
data class ImportLogError(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "log_id", nullable = false)
    val log: ImportLog,

    @Column(name = "row_number", nullable = false)
    val rowNumber: Int,

    @Column(name = "column_name", length = 255)
    val columnName: String? = null,

    @Column(name = "error_message", nullable = false, columnDefinition = "TEXT")
    val errorMessage: String
) {
    override fun equals(other: Any?): Boolean = other is ImportLogError && id == other.id
    override fun hashCode(): Int = id.hashCode()
}
