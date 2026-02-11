package com.datalens.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.OffsetDateTime

/**
 * Represents an external database connection (PostgreSQL, ClickHouse, etc.)
 * that users configure to run queries and build reports against.
 */
@Entity
@Table(name = "dl_datasource")
data class DataSource(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 200)
    var name: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    val type: DataSourceType,

    @Column(nullable = false, length = 255)
    var host: String,

    @Column(nullable = false)
    var port: Int,

    @Column(name = "database_name", nullable = false, length = 200)
    var databaseName: String,

    @Column(length = 200)
    var username: String? = null,

    @Column(name = "password_enc", length = 500)
    var passwordEnc: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extra_params", columnDefinition = "jsonb")
    var extraParams: Map<String, Any> = emptyMap(),

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    val createdBy: User? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now()
) {
    /**
     * Build JDBC URL based on the datasource type.
     */
    fun buildJdbcUrl(): String = when (type) {
        DataSourceType.POSTGRESQL ->
            "jdbc:postgresql://$host:$port/$databaseName"
        DataSourceType.CLICKHOUSE ->
            "jdbc:clickhouse://$host:$port/$databaseName"
    }
}

enum class DataSourceType {
    POSTGRESQL,
    CLICKHOUSE
}
