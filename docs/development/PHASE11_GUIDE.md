# Phase 11 — Advanced Features

## Overview

Calculated fields (expression engine), data alerts (threshold monitoring),
and bookmarks (saved filter states).

## Files to copy

### Backend — new files

| File from archive | Destination |
|---|---|
| `V7__advanced_features.sql` | `backend/src/main/resources/db/migration/V7__advanced_features.sql` |
| `AdvancedEntities.kt` | `backend/src/main/kotlin/com/datalens/model/AdvancedEntities.kt` |
| `AdvancedDtos.kt` | `backend/src/main/kotlin/com/datalens/model/dto/AdvancedDtos.kt` |
| `AdvancedRepositories.kt` | `backend/src/main/kotlin/com/datalens/repository/AdvancedRepositories.kt` |
| `CalculatedFieldService.kt` | `backend/src/main/kotlin/com/datalens/service/CalculatedFieldService.kt` |
| `DataAlertService.kt` | `backend/src/main/kotlin/com/datalens/service/DataAlertService.kt` |
| `BookmarkService.kt` | `backend/src/main/kotlin/com/datalens/service/BookmarkService.kt` |
| `AdvancedControllers.kt` | `backend/src/main/kotlin/com/datalens/controller/AdvancedControllers.kt` |

### Frontend — new files

| File from archive | Destination |
|---|---|
| `advanced.ts` | `frontend/src/api/advanced.ts` |
| `AlertsPage.tsx` | `frontend/src/components/alerts/AlertsPage.tsx` |
| `BookmarkBar.tsx` | `frontend/src/components/reports/BookmarkBar.tsx` |

> Create folder: `frontend/src/components/alerts/`

## Patches (3 existing files)

### Patch 1 — `frontend/src/types/index.ts`

Add at the end:

```typescript
// ── Calculated Fields ──

export interface CalcField {
  id: number
  reportId: number
  name: string
  label: string | null
  expression: string
  resultType: 'NUMBER' | 'STRING' | 'DATE' | 'BOOLEAN'
  formatPattern: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CalcFieldCreateRequest {
  reportId: number
  name: string
  label?: string
  expression: string
  resultType?: CalcField['resultType']
  formatPattern?: string
}

export interface CalcFieldUpdateRequest {
  name?: string
  label?: string
  expression?: string
  resultType?: CalcField['resultType']
  isActive?: boolean
}

// ── Data Alerts ──

export interface DataAlert {
  id: number
  name: string
  description: string | null
  reportId: number
  widgetId: number | null
  conditionType: 'THRESHOLD' | 'CHANGE_PERCENT' | 'ANOMALY' | 'ROW_COUNT'
  fieldName: string
  operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ' | 'BETWEEN'
  thresholdValue: number | null
  thresholdHigh: number | null
  notificationType: 'IN_APP' | 'EMAIL' | 'WEBHOOK'
  recipients: string | null
  webhookUrl: string | null
  isActive: boolean
  lastCheckedAt: string | null
  lastTriggeredAt: string | null
  lastValue: number | null
  consecutiveTriggers: number
  checkIntervalMin: number
  createdAt: string
  updatedAt: string
}

export interface AlertCreateRequest {
  name: string
  description?: string
  reportId: number
  widgetId?: number
  fieldName: string
  operator?: DataAlert['operator']
  thresholdValue?: number
  thresholdHigh?: number
  checkIntervalMin?: number
}

export interface AlertUpdateRequest {
  name?: string
  operator?: DataAlert['operator']
  thresholdValue?: number
  isActive?: boolean
}

export interface AlertCheckResult {
  alertId: number
  triggered: boolean
  currentValue: number | null
  message: string
}

export interface AlertEvent {
  id: number
  alertId: number
  eventType: string
  fieldValue: number | null
  thresholdValue: number | null
  message: string | null
  notified: boolean
  createdAt: string
}

// ── Bookmarks ──

export interface BookmarkItem {
  id: number
  reportId: number
  name: string
  description: string | null
  parameters: Record<string, unknown>
  filters: Record<string, unknown>
  isDefault: boolean
  isShared: boolean
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface BookmarkCreateRequest {
  reportId: number
  name: string
  parameters?: Record<string, unknown>
  filters?: Record<string, unknown>
  isShared?: boolean
}

export interface BookmarkUpdateRequest {
  name?: string
  parameters?: Record<string, unknown>
  isDefault?: boolean
  isShared?: boolean
}
```

### Patch 2 — `frontend/src/App.tsx`

Add import:

```typescript
import AlertsPage from '@/components/alerts/AlertsPage'
```

Add route inside `<Route element={<AppLayout />}>`:

```tsx
<Route path="/alerts" element={<AlertsPage />} />
```

### Patch 3 — `frontend/src/components/layout/Sidebar.tsx`

Add to the icon import:

```typescript
import { ..., Bell } from 'lucide-react'
```

Add to `navItems` array:

```typescript
{ to: '/alerts', icon: Bell, label: 'Alerts' },
```

### Patch 4 — `frontend/src/components/reports/ReportViewerPage.tsx`

**4a.** Add import:

```typescript
import BookmarkBar from './BookmarkBar'
```

**4b.** Add `BookmarkBar` after `ParameterPanel`. Find:

```tsx
      {/* Parameters */}
      <ParameterPanel parameters={report.parameters} onApply={handleRender} loading={rendering} />
```

Add after it:

```tsx
      {/* Bookmarks */}
      <BookmarkBar
        reportId={currentReportId || Number(id)}
        currentParameters={currentParams}
        onApplyBookmark={(params) => {
          setCurrentParams(params)
          handleRender(params)
        }}
      />
```

## API Endpoints

### Calculated Fields

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/calculated-fields` | Create field |
| `GET` | `/api/calculated-fields/{id}` | Get by ID |
| `GET` | `/api/calculated-fields/report/{id}` | List for report |
| `PUT` | `/api/calculated-fields/{id}` | Update field |
| `DELETE` | `/api/calculated-fields/{id}` | Delete field |

### Data Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/alerts` | Create alert |
| `GET` | `/api/alerts/{id}` | Get by ID |
| `GET` | `/api/alerts/report/{id}` | List for report |
| `GET` | `/api/alerts/active` | All active alerts |
| `PUT` | `/api/alerts/{id}` | Update alert |
| `DELETE` | `/api/alerts/{id}` | Delete alert |
| `POST` | `/api/alerts/{id}/check` | Check single alert |
| `POST` | `/api/alerts/check-all` | Check all due alerts |
| `GET` | `/api/alerts/{id}/events` | Alert event history |

### Bookmarks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bookmarks` | Save bookmark |
| `GET` | `/api/bookmarks/{id}` | Get by ID |
| `GET` | `/api/bookmarks/report/{id}` | List for report |
| `GET` | `/api/bookmarks/report/{id}/default` | Get default bookmark |
| `PUT` | `/api/bookmarks/{id}` | Update bookmark |
| `DELETE` | `/api/bookmarks/{id}` | Delete bookmark |

## Commit and deploy

```bash
git add backend/src/main/resources/db/migration/V7__advanced_features.sql \
       backend/src/main/kotlin/com/datalens/model/AdvancedEntities.kt \
       backend/src/main/kotlin/com/datalens/model/dto/AdvancedDtos.kt \
       backend/src/main/kotlin/com/datalens/repository/AdvancedRepositories.kt \
       backend/src/main/kotlin/com/datalens/service/CalculatedFieldService.kt \
       backend/src/main/kotlin/com/datalens/service/DataAlertService.kt \
       backend/src/main/kotlin/com/datalens/service/BookmarkService.kt \
       backend/src/main/kotlin/com/datalens/controller/AdvancedControllers.kt \
       frontend/src/api/advanced.ts \
       frontend/src/components/alerts/AlertsPage.tsx \
       frontend/src/components/reports/BookmarkBar.tsx \
       frontend/src/types/index.ts \
       frontend/src/App.tsx \
       frontend/src/components/layout/Sidebar.tsx \
       frontend/src/components/reports/ReportViewerPage.tsx

git commit -m "feat: Phase 11 — Advanced Features (calculated fields, data alerts, bookmarks)"
git push origin main
```

## What doesn't change

| File | Status |
|------|--------|
| `Dockerfile` | No changes |
| `.gitlab-ci.yml` | No changes |
| `build.gradle.kts` | No changes |
| `application.yml` | No changes |
| `SecurityConfig.kt` | No changes |
