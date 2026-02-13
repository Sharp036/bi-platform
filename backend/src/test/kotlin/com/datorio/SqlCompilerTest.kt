package com.datorio.query.compiler

import com.datorio.model.DataSourceType
import com.datorio.query.model.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class SqlCompilerTest {

    // ════════════════════════════════════════════
    //  PostgreSQL Tests
    // ════════════════════════════════════════════

    @Nested
    inner class PostgresTests {
        private val compiler = SqlCompiler(DataSourceType.POSTGRESQL)

        @Test
        fun `simple select compiles correctly`() {
            val query = VisualQuery(
                source = TableRef("sales", schema = "public", alias = "s"),
                columns = listOf(
                    SelectColumn(table = "s", column = "region", alias = "region"),
                    SelectColumn(expression = "SUM(\"s\".\"total_amount\")", alias = "revenue", aggregate = true)
                ),
                groupBy = listOf(ColumnRef(table = "s", column = "region")),
                orderBy = listOf(OrderByClause(column = "revenue", direction = SortDirection.DESC)),
                limit = 100
            )

            val result = compiler.compile(query)

            assertTrue(result.sql.contains("SELECT"))
            assertTrue(result.sql.contains("FROM \"public\".\"sales\" AS \"s\""))
            assertTrue(result.sql.contains("GROUP BY"))
            assertTrue(result.sql.contains("ORDER BY"))
            assertTrue(result.sql.contains("LIMIT 100"))
        }

        @Test
        fun `join compiles correctly`() {
            val query = VisualQuery(
                source = TableRef("orders", alias = "o"),
                joins = listOf(
                    JoinClause(
                        table = "products", alias = "p", type = JoinType.LEFT,
                        on = FilterExpression(
                            type = FilterType.COMPARISON,
                            left = ValueExpression(ValueType.COLUMN, table = "o", column = "product_id"),
                            operator = ComparisonOp.EQ,
                            right = ValueExpression(ValueType.COLUMN, table = "p", column = "id")
                        )
                    )
                ),
                columns = listOf(
                    SelectColumn(table = "o", column = "id"),
                    SelectColumn(table = "p", column = "name", alias = "product_name")
                )
            )

            val result = compiler.compile(query)

            assertTrue(result.sql.contains("LEFT JOIN"))
            assertTrue(result.sql.contains("ON"))
        }

        @Test
        fun `where clause with parameters`() {
            val query = VisualQuery(
                source = TableRef("sales", alias = "s"),
                columns = listOf(SelectColumn(table = "s", column = "total_amount")),
                filters = listOf(
                    FilterExpression(
                        type = FilterType.COMPARISON,
                        left = ValueExpression(ValueType.COLUMN, table = "s", column = "sale_date"),
                        operator = ComparisonOp.GTE,
                        right = ValueExpression(ValueType.PARAM, name = "dateFrom")
                    ),
                    FilterExpression(
                        type = FilterType.COMPARISON,
                        left = ValueExpression(ValueType.COLUMN, table = "s", column = "region"),
                        operator = ComparisonOp.EQ,
                        right = ValueExpression(ValueType.LITERAL, value = "North")
                    )
                )
            )

            val result = compiler.compile(query)

            assertTrue(result.sql.contains("WHERE"))
            assertTrue(result.sql.contains(":dateFrom"))
            assertTrue(result.sql.contains("'North'"))
            assertTrue(result.parameterNames.contains("dateFrom"))
        }

        @Test
        fun `IN clause compiles correctly`() {
            val query = VisualQuery(
                source = TableRef("sales"),
                columns = listOf(SelectColumn(column = "region")),
                filters = listOf(
                    FilterExpression(
                        type = FilterType.IN,
                        column = ValueExpression(ValueType.COLUMN, column = "region"),
                        values = listOf(
                            ValueExpression(ValueType.LITERAL, value = "North"),
                            ValueExpression(ValueType.LITERAL, value = "South")
                        )
                    )
                )
            )

            val result = compiler.compile(query)
            assertTrue(result.sql.contains("IN ('North', 'South')"))
        }

        @Test
        fun `BETWEEN clause compiles correctly`() {
            val query = VisualQuery(
                source = TableRef("sales"),
                columns = listOf(SelectColumn(column = "id")),
                filters = listOf(
                    FilterExpression(
                        type = FilterType.BETWEEN,
                        column = ValueExpression(ValueType.COLUMN, column = "amount"),
                        low = ValueExpression(ValueType.LITERAL, value = 100),
                        high = ValueExpression(ValueType.LITERAL, value = 500)
                    )
                )
            )

            val result = compiler.compile(query)
            assertTrue(result.sql.contains("BETWEEN 100 AND 500"))
        }

        @Test
        fun `nested logical filters`() {
            val query = VisualQuery(
                source = TableRef("users"),
                columns = listOf(SelectColumn(column = "name")),
                filters = listOf(
                    FilterExpression(
                        type = FilterType.LOGICAL,
                        logicalOp = LogicalOp.OR,
                        children = listOf(
                            FilterExpression(
                                type = FilterType.COMPARISON,
                                left = ValueExpression(ValueType.COLUMN, column = "status"),
                                operator = ComparisonOp.EQ,
                                right = ValueExpression(ValueType.LITERAL, value = "active")
                            ),
                            FilterExpression(
                                type = FilterType.COMPARISON,
                                left = ValueExpression(ValueType.COLUMN, column = "role"),
                                operator = ComparisonOp.EQ,
                                right = ValueExpression(ValueType.LITERAL, value = "admin")
                            )
                        )
                    )
                )
            )

            val result = compiler.compile(query)
            assertTrue(result.sql.contains("OR"))
        }

        @Test
        fun `DISTINCT select`() {
            val query = VisualQuery(
                source = TableRef("users"),
                columns = listOf(SelectColumn(column = "country")),
                distinct = true
            )

            val result = compiler.compile(query)
            assertTrue(result.sql.contains("SELECT DISTINCT"))
        }
    }

    // ════════════════════════════════════════════
    //  ClickHouse Tests
    // ════════════════════════════════════════════

    @Nested
    inner class ClickHouseTests {
        private val compiler = SqlCompiler(DataSourceType.CLICKHOUSE)

        @Test
        fun `clickhouse uses backtick identifiers`() {
            val query = VisualQuery(
                source = TableRef("page_views", schema = "sample", alias = "pv"),
                columns = listOf(
                    SelectColumn(table = "pv", column = "country"),
                    SelectColumn(expression = "COUNT(*)", alias = "views", aggregate = true)
                ),
                groupBy = listOf(ColumnRef(table = "pv", column = "country")),
                limit = 50
            )

            val result = compiler.compile(query)
            assertTrue(result.sql.contains("`sample`.`page_views`"))
            assertTrue(result.sql.contains("`pv`"))
        }

        @Test
        fun `clickhouse boolean uses 1 and 0`() {
            val query = VisualQuery(
                source = TableRef("events"),
                columns = listOf(SelectColumn(column = "id")),
                filters = listOf(
                    FilterExpression(
                        type = FilterType.COMPARISON,
                        left = ValueExpression(ValueType.COLUMN, column = "is_active"),
                        operator = ComparisonOp.EQ,
                        right = ValueExpression(ValueType.LITERAL, value = true)
                    )
                )
            )

            val result = compiler.compile(query)
            assertTrue(result.sql.contains("= 1"))
        }
    }

    // ════════════════════════════════════════════
    //  Validation Tests
    // ════════════════════════════════════════════

    @Nested
    inner class ValidationTests {
        private val compiler = SqlCompiler(DataSourceType.POSTGRESQL)

        @Test
        fun `empty table name produces error`() {
            val query = VisualQuery(
                source = TableRef(""),
                columns = listOf(SelectColumn(column = "id"))
            )
            val errors = compiler.validate(query)
            assertTrue(errors.isNotEmpty())
        }

        @Test
        fun `empty columns produces error`() {
            val query = VisualQuery(
                source = TableRef("sales"),
                columns = emptyList()
            )
            val errors = compiler.validate(query)
            assertTrue(errors.any { it.contains("column") })
        }

        @Test
        fun `valid query has no errors`() {
            val query = VisualQuery(
                source = TableRef("sales"),
                columns = listOf(SelectColumn(column = "id"))
            )
            val errors = compiler.validate(query)
            assertTrue(errors.isEmpty())
        }
    }

    // ════════════════════════════════════════════
    //  Parameter Resolver Tests
    // ════════════════════════════════════════════

    @Nested
    inner class ParameterResolverTests {
        private val resolver = ParameterResolver(DataSourceType.POSTGRESQL)

        @Test
        fun `resolves named parameters`() {
            val sql = "SELECT * FROM sales WHERE region = :region AND date >= :startDate"
            val params = mapOf("region" to "North", "startDate" to "2024-01-01")

            val resolved = resolver.resolve(sql, params)

            assertFalse(resolved.contains(":region"))
            assertFalse(resolved.contains(":startDate"))
            assertTrue(resolved.contains("'North'"))
            assertTrue(resolved.contains("'2024-01-01'"))
        }

        @Test
        fun `throws on missing parameter`() {
            val sql = "SELECT * FROM sales WHERE region = :region"
            assertThrows(IllegalArgumentException::class.java) {
                resolver.resolve(sql, emptyMap())
            }
        }

        @Test
        fun `extracts parameter names`() {
            val sql = "SELECT * FROM t WHERE a = :param1 AND b = :param2 AND c = :param1"
            val names = resolver.extractParameterNames(sql)
            assertEquals(2, names.size)
            assertTrue(names.contains("param1"))
            assertTrue(names.contains("param2"))
        }

        @Test
        fun `handles null parameters`() {
            val sql = "SELECT * FROM t WHERE a = :val"
            val resolved = resolver.resolve(sql, mapOf("val" to null))
            assertTrue(resolved.contains("NULL"))
        }

        @Test
        fun `handles numeric parameters without quotes`() {
            val sql = "SELECT * FROM t WHERE amount > :minAmount"
            val resolved = resolver.resolve(sql, mapOf("minAmount" to 100))
            assertTrue(resolved.contains("100"))
            assertFalse(resolved.contains("'100'"))
        }
    }
}
