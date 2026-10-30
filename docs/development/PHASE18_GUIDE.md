# Phase 18 — Button Widgets, Parameter Controls, Global Filters

## Новые файлы

### Backend

| Файл | Назначение |
|------|-----------|
| `V11__button_widgets_global_filters.sql` | `backend/src/main/resources/db/migration/` |
| `ControlEntities.kt` | `backend/src/main/kotlin/com/datorio/model/` |
| `ControlDtos.kt` | `backend/src/main/kotlin/com/datorio/model/dto/` |
| `ControlRepositories.kt` | `backend/src/main/kotlin/com/datorio/repository/` |
| `ControlService.kt` | `backend/src/main/kotlin/com/datorio/service/` |
| `ControlController.kt` | `backend/src/main/kotlin/com/datorio/controller/` |

### Frontend

| Файл | Назначение | Создать папку |
|------|-----------|:---:|
| `controls.ts` | `frontend/src/api/` | — |
| `ButtonWidget.tsx` | `frontend/src/components/interactive/` | — |
| `GlobalFilterBar.tsx` | `frontend/src/components/interactive/` | — |
| `GlobalFilterConfigPanel.tsx` | `frontend/src/components/interactive/` | — |
| `EnhancedParameterPanel.tsx` | `frontend/src/components/reports/` | — |
| `ParameterControlConfigPanel.tsx` | `frontend/src/components/interactive/` | — |

---

## Патчи

### 1. SecurityConfig.kt

Файл: `backend/src/main/kotlin/com/datorio/config/SecurityConfig.kt`

Найти:
```kotlin
                    .requestMatchers("/search/**").authenticated()
```
Добавить ПОСЛЕ:
```kotlin
                    .requestMatchers("/controls/**").authenticated()
```

---

### 2. ReportEntities.kt — добавить BUTTON в WidgetType enum

Файл: `backend/src/main/kotlin/com/datorio/model/ReportEntities.kt`

Найти:
```kotlin
enum class WidgetType { CHART, TABLE, KPI, TEXT, FILTER, IMAGE }
```
Заменить на:
```kotlin
enum class WidgetType { CHART, TABLE, KPI, TEXT, FILTER, IMAGE, BUTTON }
```

---

### 3. WidgetRenderer.tsx — добавить BUTTON case

Файл: `frontend/src/components/reports/WidgetRenderer.tsx`

Добавить импорт:
```tsx
import ButtonWidget from '@/components/interactive/ButtonWidget'
import type { ButtonConfig } from '@/api/controls'
```

В интерфейс `Props` добавить:
```tsx
  reportId?: number
  onToggleWidgets?: (widgetIds: number[]) => void
  onApplyFilter?: (field: string, value: string) => void
```

В деструктуризации пропсов добавить:
```tsx
  reportId, onToggleWidgets, onApplyFilter
```

Перед строкой `if (!widget.data) {` добавить обработку BUTTON:
```tsx
  if (widget.widgetType === 'BUTTON') {
    const btnConfig: ButtonConfig = widget.chartConfig ? JSON.parse(widget.chartConfig) : {}
    return (
      <ButtonWidget
        config={btnConfig}
        reportId={reportId || 0}
        onToggleWidgets={onToggleWidgets}
        onApplyFilter={onApplyFilter}
      />
    )
  }
```

---

### 4. ReportViewerPage.tsx — заменить ParameterPanel на EnhancedParameterPanel

Файл: `frontend/src/components/reports/ReportViewerPage.tsx`

Заменить импорт:
```tsx
import ParameterPanel from './ParameterPanel'
```
На:
```tsx
import EnhancedParameterPanel from './EnhancedParameterPanel'
```

Найти использование компонента:
```tsx
      <ParameterPanel parameters={report.parameters} onApply={handleRender} loading={rendering} />
```
Заменить на:
```tsx
      <EnhancedParameterPanel reportId={Number(id)} parameters={report.parameters} onApply={handleRender} loading={rendering} />
```

---

### 5. types/index.ts — добавить BUTTON в Widget type

Файл: `frontend/src/types/index.ts`

Найти:
```tsx
  widgetType: 'CHART' | 'TABLE' | 'KPI' | 'TEXT' | 'FILTER' | 'IMAGE'
```
Заменить на:
```tsx
  widgetType: 'CHART' | 'TABLE' | 'KPI' | 'TEXT' | 'FILTER' | 'IMAGE' | 'BUTTON'
```

---

## Что реализовано

### Button Widget
- 5 типов: NAVIGATE, SHOW_HIDE, FILTER, EXPORT, URL
- Настраиваемый label, icon, color, size
- Конфигурация хранится в chartConfig (JSON) виджета с widgetType=BUTTON

### Parameter Controls
- 6 типов UI: INPUT, DROPDOWN, SLIDER, RADIO, DATE_PICKER, MULTI_CHECKBOX
- Data-driven options (SQL-запрос для загрузки списка значений)
- Cascading параметры (выбор parent → перезагрузка child)
- Slider с настраиваемыми min/max/step
- Admin-панель для настройки типов контролов

### Global Filters
- Любой виджет может быть filter source (Use as Filter)
- Exclude-list: IDs виджетов, которые НЕ должны фильтроваться
- GlobalFilterBar показывает активные фильтры с возможностью сброса
- Backend resolveFilterTargets определяет цели

---

## Git Commit

```bash
git add -A
git commit -m "feat(phase18): button widgets, parameter controls, global filters

- Button widget: navigate, show/hide, filter, export, URL actions
- Enhanced parameter controls: slider, radio, multi-checkbox, cascading
- Data-driven dropdown options via SQL queries
- Global filter config: source widgets, exclude lists
- GlobalFilterBar for active cross-filter display
- V11 migration for new tables"

git push origin main
git push github main
```
