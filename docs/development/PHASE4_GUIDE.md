# Phase 4 — Query Builder & Metadata: Integration Guide

## New Files to Add

Place each file in the corresponding path under `backend/src/main/kotlin/com/datalens/`:

```
backend/src/main/kotlin/com/datalens/
├── query/
│   ├── model/
│   │   └── VisualQuery.kt          ← Visual query JSON model
│   └── compiler/
│       ├── SqlDialect.kt            ← PG & CH dialect abstraction
│       ├── SqlCompiler.kt           ← VisualQuery → SQL compiler
│       └── ParameterResolver.kt     ← Named param :name → literal
├── model/
│   ├── QueryEntities.kt            ← SavedQuery, QueryVersion, SchemaCache, etc.
│   └── dto/
│       └── QueryDtos.kt            ← All Phase 4 DTOs (add to existing Dtos.kt or separate)
├── repository/
│   └── QueryRepositories.kt        ← Add to existing Repositories.kt or separate
├── service/
│   ├── SchemaService.kt            ← Schema introspection + cache
│   └── SavedQueryService.kt        ← Saved queries CRUD, versioning, execution
└── controller/
    └── QueryControllers.kt         ← REST endpoints (replace Phase 1 QueryController)

backend/src/main/resources/db/migration/
└── V2__query_builder_metadata.sql   ← Flyway migration

backend/src/test/kotlin/com/datalens/query/compiler/
└── SqlCompilerTest.kt               ← Unit tests
```

## Files to Modify

### 1. `controller/DataSourceController.kt`
Remove the old `QueryController` class (it's replaced by `QueryExecutionController` in Phase 4).
Keep `DataSourceController` as-is.

### 2. `service/DataSourceService.kt`
Remove `executeQuery()` method — it's now handled by `SavedQueryService.executeAdHocQuery()`.
Keep all DataSource CRUD methods.

### 3. `config/SecurityConfig.kt`
Add new endpoint patterns to the security configuration:

```kotlin
// In authorizeHttpRequests:
.requestMatchers("/schema/**").authenticated()
.requestMatchers("/query-builder/**").authenticated()
.requestMatchers("/queries/**").authenticated()
.requestMatchers("/audit/**").authenticated()
```

## New API Endpoints Summary

### Schema & Metadata (`/api/schema/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/schema/datasources/{id}` | Get tables & columns (cached) |
| GET | `/schema/datasources/{id}/tables/{name}/columns` | Get specific table columns |
| POST | `/schema/preview` | Preview table data (first N rows) |
| POST | `/schema/datasources/{id}/refresh` | Force cache refresh |

### Visual Query Builder (`/api/query-builder/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/query-builder/compile` | Compile visual query → SQL preview |
| POST | `/query-builder/execute` | Compile + execute visual query |

### Saved Queries (`/api/queries/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/queries` | List saved queries (paginated, filterable) |
| GET | `/queries/{id}` | Get query details |
| POST | `/queries` | Create saved query |
| PUT | `/queries/{id}` | Update (creates new version) |
| DELETE | `/queries/{id}` | Delete |
| POST | `/queries/{id}/favorite` | Toggle favorite |
| GET | `/queries/search?q=term` | Search by name |
| POST | `/queries/{id}/execute` | Execute saved query |
| GET | `/queries/{id}/versions` | List versions |
| POST | `/queries/{id}/versions/{vid}/restore` | Restore version |

### Ad-Hoc Execution (`/api/query/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/query/execute` | Execute ad-hoc SQL (now with audit) |

### Audit Log (`/api/audit/queries/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit/queries` | Query execution history (admin only) |

## Usage Examples

### Compile a Visual Query
```bash
curl -X POST http://localhost:8080/api/query-builder/compile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "datasourceId": 1,
    "visualQuery": {
      "source": {"table": "sales", "schema": "public", "alias": "s"},
      "columns": [
        {"table": "s", "column": "region"},
        {"expression": "SUM(\"s\".\"total_amount\")", "alias": "revenue", "aggregate": true}
      ],
      "filters": [{
        "type": "COMPARISON",
        "left": {"type": "COLUMN", "table": "s", "column": "sale_date"},
        "operator": "GTE",
        "right": {"type": "PARAM", "name": "dateFrom"}
      }],
      "groupBy": [{"table": "s", "column": "region"}],
      "orderBy": [{"column": "revenue", "direction": "DESC"}],
      "limit": 100
    }
  }'
```

Response:
```json
{
  "sql": "SELECT \"s\".\"region\", SUM(\"s\".\"total_amount\") AS \"revenue\"\nFROM \"public\".\"sales\" AS \"s\"\nWHERE \"s\".\"sale_date\" >= :dateFrom\nGROUP BY \"s\".\"region\"\nORDER BY \"revenue\" DESC\nLIMIT 100",
  "parameterNames": ["dateFrom"],
  "validationErrors": []
}
```

### Save and Execute a Query
```bash
# Save the query
curl -X POST http://localhost:8080/api/queries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Revenue by Region",
    "description": "Total revenue grouped by region with date filter",
    "datasourceId": 1,
    "queryMode": "RAW",
    "sqlText": "SELECT region, SUM(total_amount) as revenue FROM sales WHERE sale_date >= :dateFrom GROUP BY region ORDER BY revenue DESC",
    "parameters": [
      {"name": "dateFrom", "type": "DATE", "label": "From Date", "defaultValue": "2024-01-01", "required": true}
    ]
  }'

# Execute with parameters
curl -X POST http://localhost:8080/api/queries/1/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dateFrom": "2024-01-01"}'
```

### Browse Schema
```bash
# Get all tables
curl http://localhost:8080/api/schema/datasources/1 \
  -H "Authorization: Bearer $TOKEN"

# Preview a table
curl -X POST http://localhost:8080/api/schema/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"datasourceId": 1, "table": "sales", "limit": 10}'
```

## Architecture Notes

### Visual Query → SQL Flow
```
Frontend (React)           Backend (Kotlin)
┌──────────────┐    POST   ┌──────────────┐
│ Query Builder │──────────→│ SqlCompiler   │
│ (drag & drop) │          │              │
│              │    JSON    │  validate()  │
│  VisualQuery  │──────────→│  compile()   │──→ SQL string
└──────────────┘           └──────────────┘
                                    │
                            ParameterResolver
                                    │
                            ┌──────────────┐
                            │ ConnectionMgr │──→ JDBC → PostgreSQL/ClickHouse
                            └──────────────┘
```

### Versioning Flow
```
SavedQuery (id=1, current_version=v3)
  ├── QueryVersion v1 (initial)
  ├── QueryVersion v2 (updated SQL)
  └── QueryVersion v3 (current) ← active

User clicks "Restore v1" →
  └── QueryVersion v4 (copy of v1, note: "Restored from v1") ← new active
```
