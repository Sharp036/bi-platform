# Phase 20 — Extended Chart Types

## Новые файлы

### Frontend

| Файл | Назначение |
|------|-----------|
| `chartTypeBuilders.ts` | `frontend/src/components/charts/` |
| `ChartTypePicker.tsx` | `frontend/src/components/charts/` |

---

## Патчи

### 1. MultiLayerChart.tsx — интеграция custom chart builders

Файл: `frontend/src/components/charts/MultiLayerChart.tsx`

**a) Добавить импорт.** После строки:
```tsx
import type { AnnotationItem, TooltipConfigItem } from '@/api/visualization'
```
Добавить:
```tsx
import { isCustomChartType, buildCustomChart } from '@/components/charts/chartTypeBuilders'
```

**b) Добавить обработку custom типов.** В `useMemo` после строки:
```tsx
    const chartType = (config.type as string) || 'bar'
```
Добавить:
```tsx
    // Custom chart types (radar, heatmap, treemap, funnel, gauge, sankey, etc.)
    if (isCustomChartType(chartType)) {
      const custom = buildCustomChart(chartType, data, config as Record<string, any>)
      if (custom) {
        const tooltipOpts = tooltipConfig
          ? buildRichTooltip(tooltipConfig)
          : (custom.tooltip ? { tooltip: custom.tooltip } : { tooltip: { trigger: 'item', confine: true } })

        let result: any = {
          ...tooltipOpts,
          legend: custom.series.length > 1 ? { bottom: 0, type: 'scroll' } : undefined,
          ...custom,
          ...((config.option as object) || {}),
        }

        if (annotations && annotations.length > 0) {
          result = mergeAnnotationsIntoOption(result, annotations)
        }

        return result
      }
    }
```

---

## Поддерживаемые типы графиков

### Существующие (без изменений)
| Тип | config.type | Данные |
|-----|-------------|--------|
| Bar | `bar` | category + values |
| Line | `line` | category + values |
| Area | `area` | category + values |
| Pie / Donut | `pie` | category + value |
| Scatter | `scatter` | category + values |

### Новые
| Тип | config.type | Данные | Примечания |
|-----|-------------|--------|------------|
| Horizontal Bar | `horizontal_bar` | category + values | swap осей, `config.barInverse` |
| Stacked Bar | `stacked_bar` | category + values | auto stack |
| Stacked Area | `stacked_area` | category + values | area + stack |
| Radar | `radar` | category + values | spider chart, `config.radarShape` |
| Heatmap | `heatmap` | x, y, value (3 колонки) | visualMap, `config.heatmapColors` |
| Treemap | `treemap` | category + value | rectangle hierarchy |
| Funnel | `funnel` | category + value | `config.funnelSort` |
| Gauge | `gauge` | single row, values | `config.gaugeMin/Max`, `config.gaugeColors` |
| Sankey | `sankey` | source, target, value (3 колонки) | flow diagram |
| Box Plot | `boxplot` | category + values | auto-calculates Q1/Q2/Q3 |
| Waterfall | `waterfall` | category + value | cumulative + total bar |
| Candlestick | `candlestick` | date, open, close, low, high (5 колонок) | `config.candleUpColor/DownColor` |

### Конфигурация через chartConfig JSON

Каждый тип читает свои параметры из `chartConfig`:

```json
// Пример: radar
{ "type": "radar", "radarShape": "circle", "radarFill": true }

// Пример: gauge
{ "type": "gauge", "gaugeMin": 0, "gaugeMax": 200, "gaugeColors": [[0.3, "#22c55e"], [0.7, "#f59e0b"], [1, "#ef4444"]] }

// Пример: waterfall
{ "type": "waterfall", "waterfallTotalLabel": "Итого", "waterfallPosColor": "#22c55e", "waterfallNegColor": "#ef4444" }

// Пример: heatmap
{ "type": "heatmap", "heatmapLabel": true }

// Пример: candlestick
{ "type": "candlestick", "openCol": "open", "closeCol": "close", "lowCol": "low", "highCol": "high" }

// Пример: horizontal_bar со стеком
{ "type": "horizontal_bar", "stack": true }
```

### ChartTypePicker

Компонент для выбора типа в UI-билдере:
```tsx
import ChartTypePicker from '@/components/charts/ChartTypePicker'

<ChartTypePicker value={chartType} onChange={setChartType} />
// или compact версия для тулбаров:
<ChartTypePicker value={chartType} onChange={setChartType} compact />
```

---

## Git Commit

```bash
git add -A
git commit -m "feat(phase20): extended chart types — 12 new chart types

- Radar, heatmap, treemap, funnel, gauge, sankey
- Boxplot, waterfall, candlestick
- Horizontal bar, stacked bar, stacked area
- ChartTypePicker UI component
- Integration with MultiLayerChart via custom builders"

git push origin main
git push github main
```
