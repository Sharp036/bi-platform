package com.datorio.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.OffsetDateTime

@Entity
@Table(name = "dl_data_model")
class DataModel(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, length = 300)
    var name: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @Column(name = "datasource_id", nullable = false)
    val datasourceId: Long,

    @Column(name = "owner_id", nullable = false)
    val ownerId: Long,

    @Column(name = "is_published", nullable = false)
    var isPublished: Boolean = false,

    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var config: String = "{}",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now()
)

@Entity
@Table(name = "dl_model_table")
class ModelTable(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "model_id", nullable = false)
    val modelId: Long,

    @Column(name = "table_schema", length = 200)
    var tableSchema: String? = null,

    @Column(name = "table_name", nullable = false, length = 200)
    var tableName: String,

    @Column(nullable = false, length = 100)
    var alias: String,

    @Column(length = 300)
    var label: String? = null,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @Column(name = "is_primary", nullable = false)
    var isPrimary: Boolean = false,

    @Column(name = "sql_expression", columnDefinition = "TEXT")
    var sqlExpression: String? = null,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

@Entity
@Table(name = "dl_model_field")
class ModelField(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "model_table_id", nullable = false)
    val modelTableId: Long,

    @Column(name = "column_name", length = 200)
    var columnName: String? = null,

    @Column(name = "field_role", nullable = false, length = 20)
    var fieldRole: String = "DIMENSION",

    @Column(nullable = false, length = 300)
    var label: String,

    @Column(columnDefinition = "TEXT")
    var description: String? = null,

    @Column(name = "data_type", length = 50)
    var dataType: String? = null,

    @Column(length = 30)
    var aggregation: String? = null,

    @Column(length = 1000)
    var expression: String? = null,

    @Column(length = 100)
    var format: String? = null,

    @Column(nullable = false)
    var hidden: Boolean = false,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var config: String = "{}",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

@Entity
@Table(name = "dl_model_relationship")
class ModelRelationship(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "model_id", nullable = false)
    val modelId: Long,

    @Column(name = "left_table_id", nullable = false)
    var leftTableId: Long,

    @Column(name = "left_column", nullable = false, length = 200)
    var leftColumn: String,

    @Column(name = "right_table_id", nullable = false)
    var rightTableId: Long,

    @Column(name = "right_column", nullable = false, length = 200)
    var rightColumn: String,

    @Column(name = "join_type", nullable = false, length = 20)
    var joinType: String = "LEFT",

    @Column(length = 300)
    var label: String? = null,

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)
