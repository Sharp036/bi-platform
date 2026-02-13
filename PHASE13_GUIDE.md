# Phase 13 — Interactive Dashboard (Tableau-like)

## Overview

Chart layers with dual axis + visibility toggle, dashboard cross-filter/highlight actions,
dynamic zone visibility rules, floating overlays (logos, images, text).

## Files to copy

### Backend — new files (6)

| File | Destination |
|---|---|
| `V8__interactive_dashboard.sql` | `backend/src/main/resources/db/migration/` |
| `InteractiveEntities.kt` | `backend/src/main/kotlin/com/datorio/model/` |
| `InteractiveDtos.kt` | `backend/src/main/kotlin/com/datorio/model/dto/` |
| `InteractiveRepositories.kt` | `backend/src/main/kotlin/com/datorio/repository/` |
| `InteractiveDashboardService.kt` | `backend/src/main/kotlin/com/datorio/service/` |
| `InteractiveController.kt` | `backend/src/main/kotlin/com/datorio/controller/` |

### Frontend — new files (6)

| File | Destination | Create folder |
|---|---|---|
| `interactive.ts` | `frontend/src/api/` | — |
| `useActionStore.ts` | `frontend/src/store/` | — |
| `MultiLayerChart.tsx` | `frontend/src/components/charts/` | — |
| `LayerTogglePanel.tsx` | `frontend/src/components/interactive/` | ✅ |
| `OverlayLayer.tsx` | `frontend/src/components/interactive/` | ✅ |
| `OverlayEditorPanel.tsx` | `frontend/src/components/interactive/` | ✅ |
| `ActionConfigPanel.tsx` | `frontend/src/components/interactive/` | ✅ |

> Create folder: `frontend/src/components/interactive/`

## Patches

### Patch 1 — `frontend/src/types/index.ts`

Add at end of file:

```typescript
// ── Phase 13: Interactive Dashboard ──

export interface ChartLayerItem {
  id: number; widgetId: number; name: string; label?: string
  queryId?: number; datasourceId?: number; rawSql?: string
  chartType: string; axis: string; color?: string; opacity: number
  isVisible: boolean; sortOrder: number
  seriesConfig: Record<string, unknown>; categoryField?: string; valueField?: string
  createdAt: string
}
export interface ChartLayerRequest {
  widgetId: number; name: string; label?: string
  queryId?: number; datasourceId?: number; rawSql?: string
  chartType?: string; axis?: string; color?: string; opacity?: number
  isVisible?: boolean; sortOrder?: number
  seriesConfig?: Record<string, unknown>; categoryField?: string; valueField?: string
  paramMapping?: Record<string, unknown>
}

export interface DashboardActionItem {
  id: number; reportId: number; name: string
  actionType: string; triggerType: string
  sourceWidgetId?: number; targetWidgetIds?: string
  sourceField?: string; targetField?: string
  targetReportId?: number; urlTemplate?: string
  isActive: boolean; sortOrder: number
  config: Record<string, unknown>; createdAt: string
}
export interface DashboardActionRequest {
  reportId: number; name: string
  actionType?: string; triggerType?: string
  sourceWidgetId?: number; targetWidgetIds?: string
  sourceField?: string; targetField?: string
  targetReportId?: number; urlTemplate?: string
  config?: Record<string, unknown>
}

export interface VisibilityRuleItem {
  id: number; widgetId: number; ruleType: string
  parameterName?: string; operator: string; expectedValue?: string
  isActive: boolean; createdAt: string
}
export interface VisibilityRuleRequest {
  widgetId: number; ruleType?: string
  parameterName?: string; operator?: string; expectedValue?: string
}

export interface OverlayItem {
  id: number; reportId: number; overlayType: string
  content?: string | null
  positionX: number; positionY: number; width: number; height: number
  opacity: number; zIndex: number; linkUrl?: string | null
  isVisible: boolean; style: Record<string, unknown>; createdAt: string
}
export interface OverlayRequest {
  reportId: number; overlayType?: string
  content?: string | null
  positionX?: number; positionY?: number; width?: number; height?: number
  opacity?: number; zIndex?: number; linkUrl?: string | null
  isVisible?: boolean; style?: Record<string, unknown>
}

export interface InteractiveMeta {
  actions: DashboardActionItem[]
  visibilityRules: Record<number, VisibilityRuleItem[]>
  overlays: OverlayItem[]
  chartLayers: Record<number, ChartLayerItem[]>
}

export interface WidgetListItem {
  id: number; title?: string; widgetType: string
}
```

### Patch 2 — `frontend/src/components/reports/WidgetRenderer.tsx`

Replace entire file with:

```typescript
import type { RenderedWidget, ChartLayerItem, WidgetData } from '@/types'
import MultiLayerChart from '@/components/charts/MultiLayerChart'
import TableWidget from '@/components/charts/TableWidget'
import KpiCard from '@/components/charts/KpiCard'
import { AlertTriangle } from 'lucide-react'

interface Props {
  widget: RenderedWidget
  layers?: ChartLayerItem[]
  layerData?: Record<number, WidgetData>
  onChartClick?: (data: Record<string, unknown>) => void
  highlightField?: string
  highlightValue?: unknown
}

export default function WidgetRenderer({
  widget, layers = [], layerData = {},
  onChartClick, highlightField, highlightValue
}: Props) {
  if (widget.error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-500 dark:text-red-400 text-sm">
        <AlertTriangle className="w-6 h-6 mb-2" />
        <p>{widget.error}</p>
      </div>
    )
  }

  if (!widget.data) {
    if (widget.widgetType === 'TEXT') {
      return (
        <div className="h-full flex items-center p-4">
          <div className="prose dark:prose-invert text-sm"
               dangerouslySetInnerHTML={{ __html: widget.title || '' }} />
        </div>
      )
    }
    if (widget.widgetType === 'IMAGE') {
      const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
      return (
        <div className="h-full flex items-center justify-center p-2">
          <img src={config.src || ''} alt={widget.title || ''} className="max-w-full max-h-full object-contain" />
        </div>
      )
    }
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data</div>
  }

  switch (widget.widgetType) {
    case 'CHART':
      return (
        <MultiLayerChart
          data={widget.data}
          chartConfig={widget.chartConfig}
          title={widget.title}
          layers={layers}
          layerData={layerData}
          onChartClick={onChartClick}
          highlightField={highlightField}
          highlightValue={highlightValue}
        />
      )
    case 'TABLE':
      return <TableWidget data={widget.data} title={widget.title} />
    case 'KPI':
      return <KpiCard data={widget.data} title={widget.title} chartConfig={widget.chartConfig} />
    default:
      return <TableWidget data={widget.data} title={widget.title} />
  }
}
```

### Patch 3 — `frontend/src/components/reports/ReportViewerPage.tsx`

Add imports at top:

```typescript
import OverlayLayer from '@/components/interactive/OverlayLayer'
import { useActionStore } from '@/store/useActionStore'
import { interactiveApi } from '@/api/interactive'
import type { InteractiveMeta, ChartLayerItem, WidgetData } from '@/types'
```

After report is loaded (inside the useEffect that fetches the report), add:

```typescript
// Load interactive meta
const widgetIds = rendered.widgets.map(w => w.widgetId)
interactiveApi.getMeta(reportId, widgetIds).then(meta => {
  setInteractiveMeta(meta)
  useActionStore.getState().setActions(meta.actions)
}).catch(() => {})
```

Add state:

```typescript
const [interactiveMeta, setInteractiveMeta] = useState<InteractiveMeta | null>(null)
```

Wrap the grid area with `position: relative` and add OverlayLayer after the widget grid:

```tsx
{interactiveMeta?.overlays && interactiveMeta.overlays.length > 0 && (
  <OverlayLayer overlays={interactiveMeta.overlays} />
)}
```

Pass layers and onChartClick to WidgetRenderer:

```tsx
<WidgetRenderer
  widget={widget}
  layers={interactiveMeta?.chartLayers?.[widget.widgetId] || []}
  onChartClick={(data) => {
    useActionStore.getState().triggerAction(widget.widgetId, 'CLICK', data)
  }}
/>
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/PUT/DELETE | `/interactive/layers` | Chart layer CRUD |
| GET | `/interactive/layers/widget/{widgetId}` | Layers for widget |
| POST/PUT/DELETE | `/interactive/actions` | Dashboard action CRUD |
| GET | `/interactive/actions/report/{id}` | Actions for report |
| POST/PUT/DELETE | `/interactive/visibility` | Visibility rule CRUD |
| GET | `/interactive/visibility/widget/{id}` | Rules for widget |
| POST/PUT/DELETE | `/interactive/overlays` | Overlay CRUD |
| GET | `/interactive/overlays/report/{id}` | Overlays for report |
| GET | `/interactive/meta/report/{id}` | Full interactive metadata |

## Commit

```bash
git add -A
git commit -m "feat: Phase 13 — Interactive Dashboard (chart layers, cross-filter actions, DZV, overlays/logos)"
git push origin main
```
