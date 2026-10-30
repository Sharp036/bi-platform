# Phase 8 — Drill-Down Reports

## Overview

Click-to-navigate between reports: click a chart bar or table row → drill into a
child report with parameters auto-filled from the clicked data. Full breadcrumb
navigation with back-navigation and state restoration.

## Architecture

```
┌─ Report A (Regions) ──────────────────────┐
│  ┌────────────────────┐                    │
│  │ Chart: Sales by    │   click "Europe"   │
│  │ Region   ─────────────────┐             │
│  └────────────────────┘      │             │
└──────────────────────────────│─────────────┘
                               ▼
┌─ Report B (Region Detail) ───│─────────────┐
│  param: region = "Europe"    │             │
│  ┌────────────────────┐      │             │
│  │ Table: Sales by    │  click "Germany"   │
│  │ Country   ─────────────────┐            │
│  └────────────────────┘       │            │
│  Breadcrumb: [Regions] > Europe             │
└───────────────────────────────│─────────────┘
                                ▼
┌─ Report C (Country Detail) ───│─────────────┐
│  param: country = "Germany"   │             │
│  Breadcrumb: [Regions] > Europe > Germany   │
└─────────────────────────────────────────────┘
```

## Files to copy

### Backend — new files

| File from archive | Destination |
|---|---|
| `V5__drill_down_reports.sql` | `backend/src/main/resources/db/migration/V5__drill_down_reports.sql` |
| `DrillDownEntities.kt` | `backend/src/main/kotlin/com/datalens/model/DrillDownEntities.kt` |
| `DrillDownDtos.kt` | `backend/src/main/kotlin/com/datalens/model/dto/DrillDownDtos.kt` |
| `DrillDownRepository.kt` | `backend/src/main/kotlin/com/datalens/repository/DrillDownRepository.kt` |
| `DrillDownService.kt` | `backend/src/main/kotlin/com/datalens/service/DrillDownService.kt` |
| `DrillDownController.kt` | `backend/src/main/kotlin/com/datalens/controller/DrillDownController.kt` |

### Frontend — new files

| File from archive | Destination |
|---|---|
| `drilldown.ts` | `frontend/src/api/drilldown.ts` |
| `DrillDownBreadcrumb.tsx` | `frontend/src/components/reports/DrillDownBreadcrumb.tsx` |

### Frontend — REPLACE files

| File from archive | Destination (overwrite) |
|---|---|
| `ReportViewerPage.tsx` | `frontend/src/components/reports/ReportViewerPage.tsx` |
| `WidgetRenderer.tsx` | `frontend/src/components/reports/WidgetRenderer.tsx` |
| `EChartWidget.tsx` | `frontend/src/components/charts/EChartWidget.tsx` |
| `TableWidget.tsx` | `frontend/src/components/charts/TableWidget.tsx` |

### Frontend — patch existing file

#### `frontend/src/types/index.ts` — add at the end:

```typescript
// ── Drill-Down ──

export interface DrillAction {
  id: number
  sourceWidgetId: number
  targetReportId: number
  targetReportName: string | null
  actionType: 'DRILL_DOWN' | 'DRILL_THROUGH' | 'CROSS_LINK'
  label: string | null
  description: string | null
  paramMapping: Record<string, { source: string; value: string }>
  triggerType: 'ROW_CLICK' | 'CHART_CLICK' | 'BUTTON'
  openMode: 'REPLACE' | 'NEW_TAB'
  isActive: boolean
  sortOrder: number
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface DrillActionCreateRequest {
  sourceWidgetId: number
  targetReportId: number
  actionType?: DrillAction['actionType']
  label?: string
  description?: string
  paramMapping?: Record<string, { source: string; value: string }>
  triggerType?: DrillAction['triggerType']
  openMode?: DrillAction['openMode']
  sortOrder?: number
}

export interface DrillActionUpdateRequest {
  targetReportId?: number
  actionType?: DrillAction['actionType']
  label?: string
  paramMapping?: Record<string, { source: string; value: string }>
  triggerType?: DrillAction['triggerType']
  openMode?: DrillAction['openMode']
  isActive?: boolean
}

export interface DrillNavigateResponse {
  targetReportId: number
  targetReportName: string
  resolvedParameters: Record<string, unknown>
  openMode: 'REPLACE' | 'NEW_TAB'
  breadcrumbLabel: string
}
```

## Commit and deploy

```bash
git add backend/src/main/resources/db/migration/V5__drill_down_reports.sql \
       backend/src/main/kotlin/com/datalens/model/DrillDownEntities.kt \
       backend/src/main/kotlin/com/datalens/model/dto/DrillDownDtos.kt \
       backend/src/main/kotlin/com/datalens/repository/DrillDownRepository.kt \
       backend/src/main/kotlin/com/datalens/service/DrillDownService.kt \
       backend/src/main/kotlin/com/datalens/controller/DrillDownController.kt \
       frontend/src/api/drilldown.ts \
       frontend/src/components/reports/DrillDownBreadcrumb.tsx \
       frontend/src/components/reports/ReportViewerPage.tsx \
       frontend/src/components/reports/WidgetRenderer.tsx \
       frontend/src/components/charts/EChartWidget.tsx \
       frontend/src/components/charts/TableWidget.tsx \
       frontend/src/types/index.ts

git commit -m "feat: Phase 8 — Drill-Down Reports (navigation, breadcrumbs, parameter passing)"
git push origin main
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/drill-actions` | Create drill action |
| `GET` | `/api/drill-actions/{id}` | Get action by ID |
| `PUT` | `/api/drill-actions/{id}` | Update action |
| `DELETE` | `/api/drill-actions/{id}` | Delete action |
| `GET` | `/api/drill-actions/widget/{widgetId}` | Actions for a widget |
| `GET` | `/api/drill-actions/report/{reportId}` | All actions in a report (batch) |
| `POST` | `/api/drill-actions/navigate` | Resolve navigation (compute target params) |

## How Drill-Down Works

### 1. Configure (API call or future UI)

Create a drill action linking a widget to a target report:

```json
POST /api/drill-actions
{
  "sourceWidgetId": 5,
  "targetReportId": 2,
  "actionType": "DRILL_DOWN",
  "label": "View Region Detail",
  "triggerType": "CHART_CLICK",
  "paramMapping": {
    "region": { "source": "column", "value": "region" },
    "year": { "source": "fixed", "value": "2024" }
  }
}
```

### 2. User clicks

User clicks a bar in the chart → frontend sends clicked data to `/navigate`:

```json
POST /api/drill-actions/navigate
{
  "actionId": 1,
  "clickedData": { "region": "Europe", "amount": 5000, "name": "Europe" },
  "currentParameters": { "year": "2024" }
}
```

### 3. Backend resolves parameters

Response tells frontend where to go and with what parameters:

```json
{
  "targetReportId": 2,
  "targetReportName": "Region Detail",
  "resolvedParameters": { "region": "Europe", "year": "2024" },
  "openMode": "REPLACE",
  "breadcrumbLabel": "Europe"
}
```

### 4. Frontend navigates

Frontend pushes to navigation stack, loads new report with resolved parameters,
shows breadcrumb: `[Sales Overview] > Europe`

### 5. Back navigation

Click breadcrumb to go back — pops stack, restores previous report + parameters.

## Parameter Mapping Sources

| Source | Description | Example |
|--------|-------------|---------|
| `column` | Value from clicked row/data by column name | `{ "source": "column", "value": "region" }` |
| `series` | Series name from chart click | `{ "source": "series", "value": "seriesName" }` |
| `category` | Category/label from chart click | `{ "source": "category", "value": "name" }` |
| `value` | Numeric value from chart click | `{ "source": "value", "value": "amount" }` |
| `fixed` | Hardcoded constant | `{ "source": "fixed", "value": "2024" }` |
| `current_param` | Pass through from current report parameter | `{ "source": "current_param", "value": "year" }` |

## What doesn't change

| File | Status |
|------|--------|
| `Dockerfile` | No changes |
| `.gitlab-ci.yml` | No changes |
| `docker-compose.prod.yml` | No changes |
| `build.gradle.kts` | No changes |
| `application.yml` | No changes |
| `App.tsx` | No changes (route `/reports/:id` already exists) |
| `Sidebar.tsx` | No changes |
