# Phase 19 — Enhanced Tooltips, Annotations, Containers, Dashboard Objects

## Новые файлы

### Backend

| Файл | Назначение |
|------|-----------|
| `V12__annotations_containers.sql` | `backend/src/main/resources/db/migration/` |
| `VisualizationEntities.kt` | `backend/src/main/kotlin/com/datorio/model/` |
| `VisualizationDtos.kt` | `backend/src/main/kotlin/com/datorio/model/dto/` |
| `VisualizationRepositories.kt` | `backend/src/main/kotlin/com/datorio/repository/` |
| `VisualizationService.kt` | `backend/src/main/kotlin/com/datorio/service/` |
| `VisualizationController.kt` | `backend/src/main/kotlin/com/datorio/controller/` |

### Frontend

| Файл | Назначение | Создать папку |
|------|-----------|:---:|
| `visualization.ts` | `frontend/src/api/` | — |
| `buildAnnotationOptions.ts` | `frontend/src/components/charts/` | — |
| `buildRichTooltip.ts` | `frontend/src/components/charts/` | — |
| `TabContainer.tsx` | `frontend/src/components/interactive/` | — |
| `DashboardObjects.tsx` | `frontend/src/components/interactive/` | — |
| `AnnotationEditor.tsx` | `frontend/src/components/interactive/` | — |

---

## Патчи

### 1. SecurityConfig.kt

Найти:
```kotlin
                    .requestMatchers("/controls/**").authenticated()
```
Добавить ПОСЛЕ:
```kotlin
                    .requestMatchers("/visualization/**").authenticated()
```

---

### 2. ReportEntities.kt — добавить новые WidgetType

Найти:
```kotlin
enum class WidgetType { CHART, TABLE, KPI, TEXT, FILTER, IMAGE, BUTTON }
```
Заменить на:
```kotlin
enum class WidgetType { CHART, TABLE, KPI, TEXT, FILTER, IMAGE, BUTTON, WEBPAGE, SPACER, DIVIDER }
```

---

### 3. types/index.ts — добавить новые типы

Найти:
```tsx
  widgetType: 'CHART' | 'TABLE' | 'KPI' | 'TEXT' | 'FILTER' | 'IMAGE' | 'BUTTON'
```
Заменить на:
```tsx
  widgetType: 'CHART' | 'TABLE' | 'KPI' | 'TEXT' | 'FILTER' | 'IMAGE' | 'BUTTON' | 'WEBPAGE' | 'SPACER' | 'DIVIDER'
```

---

### 4. WidgetRenderer.tsx — добавить новые виджеты и annotations

Добавить импорты:
```tsx
import { WebPageWidget, SpacerWidget, DividerWidget, RichTextWidget, ImageWidget } from '@/components/interactive/DashboardObjects'
import type { AnnotationItem, TooltipConfigItem } from '@/api/visualization'
```

В интерфейс Props добавить:
```tsx
  annotations?: AnnotationItem[]
  tooltipConfig?: TooltipConfigItem
```

В деструктуризации пропсов добавить:
```tsx
  annotations, tooltipConfig
```

Добавить case-ы ПЕРЕД `if (!widget.data)`. После блока `if (widget.widgetType === 'BUTTON')` добавить:
```tsx
  if (widget.widgetType === 'WEBPAGE') {
    const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
    return <WebPageWidget url={config.url || ''} title={widget.title} />
  }

  if (widget.widgetType === 'SPACER') {
    const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
    return <SpacerWidget height={config.height} color={config.color} />
  }

  if (widget.widgetType === 'DIVIDER') {
    const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
    return <DividerWidget
      orientation={config.orientation}
      color={config.color}
      thickness={config.thickness}
      style={config.style}
      label={config.label}
    />
  }
```

Также заменить существующую обработку `TEXT` (строка с `if (widget.widgetType === 'TEXT')`). Найти:
```tsx
    if (widget.widgetType === 'TEXT') {
      return (
        <div className="h-full flex items-center p-4">
          <div className="prose dark:prose-invert text-sm"
               dangerouslySetInnerHTML={{ __html: widget.title || '' }} />
        </div>
      )
    }
```
Заменить на:
```tsx
    if (widget.widgetType === 'TEXT') {
      const styleConfig = widget.style ? JSON.parse(widget.style) : {}
      return <RichTextWidget content={widget.title || ''} style={styleConfig} />
    }
```

Также заменить обработку `IMAGE`. Найти:
```tsx
    if (widget.widgetType === 'IMAGE') {
      const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
      return (
        <div className="h-full flex items-center justify-center p-2">
          <img src={config.src || ''} alt={widget.title || ''} className="max-w-full max-h-full object-contain" />
        </div>
      )
    }
```
Заменить на:
```tsx
    if (widget.widgetType === 'IMAGE') {
      const config = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
      return <ImageWidget src={config.src || ''} alt={widget.title} linkUrl={config.linkUrl} fit={config.fit} borderRadius={config.borderRadius} />
    }
```

---

### 5. MultiLayerChart.tsx — интегрировать annotations и rich tooltips

Добавить импорты:
```tsx
import { mergeAnnotationsIntoOption } from '@/components/charts/buildAnnotationOptions'
import { buildRichTooltip } from '@/components/charts/buildRichTooltip'
import type { AnnotationItem, TooltipConfigItem } from '@/api/visualization'
```

В интерфейс Props добавить:
```tsx
  annotations?: AnnotationItem[]
  tooltipConfig?: TooltipConfigItem
```

В деструктуризации пропсов добавить:
```tsx
  annotations, tooltipConfig
```

В конце `useMemo` (перед `return { tooltip: ...` ) — заменить финальный return. Найти:
```tsx
    return {
      tooltip: { trigger: isPie ? 'item' : 'axis', confine: true },
```
Заменить на:
```tsx
    const tooltipOpts = tooltipConfig
      ? buildRichTooltip(tooltipConfig)
      : { tooltip: { trigger: isPie ? 'item' : 'axis', confine: true } }

    let result = {
      ...tooltipOpts,
```

И в конце того же return (перед закрывающей `}`) заменить `...((config.option as object) || {}),` — найти:
```tsx
      ...((config.option as object) || {}),
    }
```
Заменить на:
```tsx
      ...((config.option as object) || {}),
    }

    // Apply annotations
    if (annotations && annotations.length > 0) {
      result = mergeAnnotationsIntoOption(result, annotations)
    }

    return result
```

Также добавить `annotations, tooltipConfig` в зависимости useMemo. Найти:
```tsx
  }, [data, config, layersWithVisibility, layerData, highlightField, highlightValue])
```
Заменить на:
```tsx
  }, [data, config, layersWithVisibility, layerData, highlightField, highlightValue, annotations, tooltipConfig])
```

---

## Git Commit

```bash
git add -A
git commit -m "feat(phase19): enhanced tooltips, annotations, containers, dashboard objects

- Chart annotations: reference lines, bands, trend lines, text marks
- Rich tooltips: custom fields, formatting, sparkline placeholder, HTML template
- Widget containers: tabs, accordion, horizontal/vertical layout
- Dashboard objects: webpage (iframe), spacer, divider, enhanced text/image
- Annotation editor admin panel
- V12 migration for dl_chart_annotation, dl_tooltip_config, dl_widget_container"

git push origin main
git push github main
```
