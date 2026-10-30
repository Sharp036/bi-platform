# DataLens BI — Phase 5: Report Engine — Integration Guide

## Overview

Phase 5 adds the **Report Engine** — the core system for defining, rendering,
scheduling, and snapshotting reports built on top of saved queries from Phase 4.

### What's included

| Component | Description |
|-----------|-------------|
| `OpenApiConfig.kt` | Swagger Authorize button (promised from Phase 4) |
| `ReportEntities.kt` | Report, ReportParameter, ReportWidget, DashboardReport, ReportSchedule, ReportSnapshot |
| `ReportDtos.kt` | All request/response DTOs |
| `ReportRepositories.kt` | 6 JPA repositories |
| `ReportService.kt` | CRUD for reports, parameters, widgets |
| `ReportRenderService.kt` | Server-side report rendering (execute all widget queries) |
| `ReportScheduleService.kt` | Schedule CRUD + execution |
| `DashboardService.kt` | Dashboard ↔ Report management |
| `ReportScheduler.kt` | Background cron-based execution |
| `ReportControllers.kt` | REST endpoints (3 controllers) |
| `V3__report_engine.sql` | Flyway migration |
| `ReportServiceTest.kt` | 15 unit tests |

## File placement

```
backend/src/main/kotlin/com/datalens/
├── config/
│   └── OpenApiConfig.kt          ← NEW (adds Authorize button to Swagger)
├── model/
│   ├── ReportEntities.kt         ← NEW
│   └── dto/
│       └── ReportDtos.kt         ← NEW
├── repository/
│   └── ReportRepositories.kt     ← NEW
├── service/
│   ├── ReportService.kt          ← NEW
│   ├── ReportRenderService.kt    ← NEW
│   ├── ReportScheduleService.kt  ← NEW
│   └── DashboardService.kt       ← NEW
├── scheduling/
│   └── ReportScheduler.kt        ← NEW
├── controller/
│   └── ReportControllers.kt      ← NEW

backend/src/main/resources/db/migration/
└── V3__report_engine.sql          ← NEW

backend/src/test/kotlin/com/datalens/
└── ReportServiceTest.kt           ← NEW
```

## Integration steps

### 1. Copy files

Place each file from the archive into the corresponding path shown above.
Create the `scheduling/` directory if it doesn't exist.

### 2. Enable scheduling in Spring Boot

In `backend/src/main/kotlin/com/datalens/DataLensApplication.kt`, add the
`@EnableScheduling` annotation:

```kotlin
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling   // ← ADD THIS
class DataLensApplication
```

### 3. Add mockito-kotlin test dependency

In `backend/build.gradle.kts`, add to the `dependencies` block:

```kotlin
testImplementation("org.mockito.kotlin:mockito-kotlin:5.2.1")
```

### 4. Update SecurityConfig

In your `SecurityConfig.kt`, add the new endpoints to the security filter chain.
Find the section where you authorize endpoints and add:

```kotlin
// Phase 5 — Report Engine
.requestMatchers("/reports/**").authenticated()
.requestMatchers("/schedules/**").authenticated()
.requestMatchers("/dashboards/*/reports/**").authenticated()
```

### 5. Commit and push

```bash
git add .
git commit -m "Phase 5: Report Engine"
git push origin main
```

Flyway will automatically apply `V3__report_engine.sql` on startup.

## New REST API Endpoints

### Reports (`/api/reports/`)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/reports` | REPORT_EDIT | Create report with params & widgets |
| GET | `/reports/{id}` | REPORT_VIEW | Get report details |
| GET | `/reports` | REPORT_VIEW | List reports (filter by status, folderId) |
| GET | `/reports/search?q=` | REPORT_VIEW | Search by name |
| GET | `/reports/templates` | REPORT_VIEW | List report templates |
| PUT | `/reports/{id}` | REPORT_EDIT | Update report |
| POST | `/reports/{id}/publish` | REPORT_PUBLISH | Set status to PUBLISHED |
| POST | `/reports/{id}/archive` | REPORT_EDIT | Set status to ARCHIVED |
| POST | `/reports/{id}/duplicate` | REPORT_EDIT | Duplicate report |
| POST | `/reports/from-template/{id}` | REPORT_EDIT | Create from template |
| DELETE | `/reports/{id}` | REPORT_EDIT | Delete report |

### Parameters (`/api/reports/{id}/parameters`)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/reports/{id}/parameters` | REPORT_VIEW | Get report parameters |
| PUT | `/reports/{id}/parameters` | REPORT_EDIT | Replace all parameters |

### Widgets (`/api/reports/{id}/widgets`)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/reports/{id}/widgets` | REPORT_VIEW | List widgets |
| POST | `/reports/{id}/widgets` | REPORT_EDIT | Add widget |
| PUT | `/reports/widgets/{widgetId}` | REPORT_EDIT | Update widget |
| DELETE | `/reports/widgets/{widgetId}` | REPORT_EDIT | Remove widget |

### Render & Snapshots

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/reports/{id}/render` | REPORT_VIEW | Render report (execute all widget queries) |
| POST | `/reports/{id}/snapshot` | REPORT_EDIT | Create a point-in-time snapshot |
| GET | `/reports/{id}/snapshots` | REPORT_VIEW | List snapshots |
| GET | `/reports/{id}/snapshots/latest` | REPORT_VIEW | Get latest snapshot |

### Schedules (`/api/schedules/`)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/schedules` | SCHEDULE_MANAGE | Create schedule |
| GET | `/schedules/{id}` | SCHEDULE_MANAGE | Get schedule |
| GET | `/schedules` | SCHEDULE_MANAGE | List active schedules |
| GET | `/schedules/report/{reportId}` | SCHEDULE_MANAGE | Schedules for a report |
| PUT | `/schedules/{id}` | SCHEDULE_MANAGE | Update schedule |
| POST | `/schedules/{id}/toggle` | SCHEDULE_MANAGE | Toggle active/paused |
| POST | `/schedules/{id}/execute` | SCHEDULE_MANAGE | Execute immediately |
| DELETE | `/schedules/{id}` | SCHEDULE_MANAGE | Delete schedule |

### Dashboard ↔ Reports (`/api/dashboards/{id}/reports/`)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/dashboards/{id}/reports` | DASHBOARD_VIEW | List reports in dashboard |
| POST | `/dashboards/{id}/reports` | DASHBOARD_EDIT | Add report to dashboard |
| DELETE | `/dashboards/{id}/reports/{reportId}` | DASHBOARD_EDIT | Remove from dashboard |

## Example usage

### Create a report with chart widget

```json
POST /api/reports
{
  "name": "Monthly Sales",
  "description": "Sales breakdown by region and product",
  "parameters": [
    {
      "name": "dateFrom",
      "label": "Start Date",
      "paramType": "DATE",
      "isRequired": true
    },
    {
      "name": "dateTo",
      "label": "End Date",
      "paramType": "DATE",
      "isRequired": true
    },
    {
      "name": "region",
      "label": "Region",
      "paramType": "SELECT",
      "defaultValue": "ALL",
      "config": "{\"options\":[\"ALL\",\"North\",\"South\",\"East\",\"West\"]}"
    }
  ],
  "widgets": [
    {
      "widgetType": "CHART",
      "title": "Revenue by Region",
      "queryId": 1,
      "chartConfig": "{\"type\":\"bar\",\"xAxis\":{\"field\":\"region\"},\"yAxis\":{\"field\":\"revenue\"}}",
      "position": "{\"x\":0,\"y\":0,\"w\":6,\"h\":4}",
      "paramMapping": "{\"dateFrom\":\"dateFrom\",\"dateTo\":\"dateTo\",\"region\":\"region\"}"
    },
    {
      "widgetType": "KPI",
      "title": "Total Revenue",
      "queryId": 2,
      "chartConfig": "{\"format\":\"currency\",\"prefix\":\"$\"}",
      "position": "{\"x\":6,\"y\":0,\"w\":3,\"h\":2}"
    },
    {
      "widgetType": "TABLE",
      "title": "Sales Details",
      "queryId": 3,
      "position": "{\"x\":0,\"y\":4,\"w\":12,\"h\":6}"
    }
  ]
}
```

### Render with parameters

```json
POST /api/reports/1/render
{
  "parameters": {
    "dateFrom": "2024-01-01",
    "dateTo": "2024-12-31",
    "region": "North"
  }
}
```

Response contains data for each widget:

```json
{
  "reportId": 1,
  "reportName": "Monthly Sales",
  "parameters": {"dateFrom": "2024-01-01", "dateTo": "2024-12-31", "region": "North"},
  "widgets": [
    {
      "widgetId": 1,
      "widgetType": "CHART",
      "title": "Revenue by Region",
      "chartConfig": "{...}",
      "data": {
        "columns": ["region", "revenue"],
        "rows": [["North", 150000], ["East", 120000]],
        "rowCount": 2,
        "executionMs": 45
      }
    },
    ...
  ],
  "executionMs": 120
}
```

### Schedule a weekly report

```json
POST /api/schedules
{
  "reportId": 1,
  "cronExpression": "0 8 * * 1",
  "parameters": "{\"dateFrom\":\"2024-01-01\",\"dateTo\":\"2024-12-31\"}",
  "outputFormat": "JSON",
  "recipients": "[{\"email\":\"team@example.com\"}]"
}
```

## Architecture notes

### Report → Widget → Query data flow

```
Report (layout, params)
  └── Widget 1 (CHART, queryId=5, paramMapping)
  │     └── SavedQuery #5 → SQL → DataSource → data rows
  └── Widget 2 (TABLE, rawSql, datasourceId)
  │     └── inline SQL → DataSource → data rows
  └── Widget 3 (KPI, queryId=8)
  │     └── SavedQuery #8 → SQL → DataSource → single value
  └── Widget 4 (TEXT)
        └── no query, static content
```

### Parameter resolution

1. Report defines parameters (dateFrom, dateTo, region)
2. User provides values at render time
3. Missing values filled from defaults
4. Widget paramMapping maps report params → query params
5. Query executed with resolved parameters

### Scheduling

- `ReportScheduler` runs every 60 seconds
- Checks all active schedules against current time
- Uses Spring `CronExpression` for matching
- Creates a `ReportSnapshot` for each execution
- Prevents "catch-up storms" (max 2 min lookback)

## Permissions added

| Permission | Granted to |
|------------|-----------|
| REPORT_VIEW | ADMIN, EDITOR, VIEWER |
| REPORT_EDIT | ADMIN, EDITOR |
| REPORT_PUBLISH | ADMIN |
| DASHBOARD_VIEW | ADMIN, EDITOR, VIEWER |
| DASHBOARD_EDIT | ADMIN, EDITOR |
| SCHEDULE_MANAGE | ADMIN |

## Next phase

**Phase 6 — Frontend: React Dashboard & Report Viewer**
- React 18 + TypeScript + Vite
- Authentication UI
- Dashboard grid layout (react-grid-layout)
- ECharts integration
- Report parameter panel
- Auto-refresh
