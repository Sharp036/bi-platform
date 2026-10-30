# Phase 9 — Report Designer (Visual)

## Overview

Visual report builder with component palette, grid canvas, property panel,
data binding, parameter configuration, undo/redo, and preview mode.

## Files to copy

### Frontend — new files

| File from archive | Destination |
|---|---|
| `useDesignerStore.ts` | `frontend/src/store/useDesignerStore.ts` |
| `ReportDesignerPage.tsx` | `frontend/src/components/designer/ReportDesignerPage.tsx` |
| `ComponentPalette.tsx` | `frontend/src/components/designer/ComponentPalette.tsx` |
| `DesignerCanvas.tsx` | `frontend/src/components/designer/DesignerCanvas.tsx` |
| `PropertyPanel.tsx` | `frontend/src/components/designer/PropertyPanel.tsx` |
| `ParameterDesigner.tsx` | `frontend/src/components/designer/ParameterDesigner.tsx` |

> **Note:** Create folders:
> - `frontend/src/store/` (if doesn't exist)
> - `frontend/src/components/designer/`

### Frontend — patches (3 existing files)

Details below.

### Backend

No backend changes. Existing report/widget CRUD endpoints are sufficient.

## Patch 1 — `frontend/src/App.tsx`

Add import:

```typescript
import ReportDesignerPage from '@/components/designer/ReportDesignerPage'
```

Add two routes inside `<Route element={<AppLayout />}>`, BEFORE the `/reports/:id` route:

```tsx
<Route path="/reports/new" element={<ReportDesignerPage />} />
<Route path="/reports/:id/edit" element={<ReportDesignerPage />} />
```

Full routes block should look like:

```tsx
<Route path="/" element={<DashboardPage />} />
<Route path="/reports" element={<ReportListPage />} />
<Route path="/reports/new" element={<ReportDesignerPage />} />
<Route path="/reports/:id/edit" element={<ReportDesignerPage />} />
<Route path="/reports/:id" element={<ReportViewerPage />} />
<Route path="/queries" element={<QueryListPage />} />
<Route path="/scripts" element={<ScriptEditorPage />} />
<Route path="/datasources" element={<DataSourceListPage />} />
<Route path="/schedules" element={<ScheduleListPage />} />
```

> **Important:** `/reports/new` and `/reports/:id/edit` MUST be BEFORE `/reports/:id`, otherwise React Router matches `:id` first.

## Patch 2 — `frontend/src/api/reports.ts`

Add three methods to the `reportApi` object:

```typescript
  // Add these inside reportApi = { ... }:

  setParameters: (reportId: number, params: Array<Record<string, unknown>>) =>
    api.put(`/reports/${reportId}/parameters`, params).then(r => r.data),

  deleteWidget: (widgetId: number) =>
    api.delete(`/reports/widgets/${widgetId}`),

  updateWidget: (widgetId: number, data: Record<string, unknown>) =>
    api.put(`/reports/widgets/${widgetId}`, data).then(r => r.data),
```

## Patch 3 — `frontend/src/components/reports/ReportListPage.tsx`

Find the "Edit" action or add one. In the card action buttons (around the `<Eye>`, `<Copy>`, `<Archive>` buttons), add an Edit link:

```typescript
// Add to imports:
import { FileBarChart, Plus, Eye, Copy, Archive, Search, Pencil } from 'lucide-react'

// In the action buttons div, add before the Eye link:
<Link to={`/reports/${r.id}/edit`} className="btn-ghost p-1.5 text-xs"><Pencil className="w-3.5 h-3.5" /></Link>
```

## Commit and deploy

```bash
git add frontend/src/store/useDesignerStore.ts \
       frontend/src/components/designer/ \
       frontend/src/App.tsx \
       frontend/src/api/reports.ts \
       frontend/src/components/reports/ReportListPage.tsx

git commit -m "feat: Phase 9 — Report Designer (visual canvas, palette, properties, undo/redo)"
git push origin main
```

## How It Works

### Component Palette (left panel)
- Click any component type → adds to canvas at next available position
- 6 widget types: Chart, Table, KPI, Text, Filter, Image

### Canvas (center)
- 12-column grid layout matching the report viewer
- Click widget to select, click background to deselect
- Widgets show type icon, title, and data binding status

### Property Panel (right panel)
- Title, position (x, y, w, h), visibility
- Data binding: select saved query OR write inline SQL
- Chart type selector for CHART widgets
- KPI format options (number, currency, percent)
- HTML editor for TEXT widgets
- Image URL for IMAGE widgets
- Duplicate / Delete actions

### Settings (toolbar toggle)
- Report name, description, status
- Parameter designer: add/edit/remove parameters with types and defaults

### Undo/Redo
- Ctrl+Z / Ctrl+Y keyboard shortcuts
- Full widget state history

### Preview Mode
- Hides palette and property panel
- Shows canvas in full width (same as report viewer)

### Save
- New reports: POST /api/reports with all widgets and parameters
- Existing: Updates metadata, re-syncs parameters, deletes and re-creates widgets

## What doesn't change

| File | Status |
|------|--------|
| `Dockerfile` | No changes |
| `.gitlab-ci.yml` | No changes |
| `build.gradle.kts` | No changes |
| Backend code | No changes |
| `Sidebar.tsx` | No changes |
