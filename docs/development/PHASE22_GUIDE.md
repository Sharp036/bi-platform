# Phase 22 — Dashboard Templates & Marketplace

## Обзор

Галерея шаблонов с категориями, JSON-экспорт/импорт конфигураций отчётов (.datorio.json).

## Новые файлы (6)

### Backend (4)
| Файл | Куда |
|------|------|
| `V14__template_marketplace.sql` | `backend/src/main/resources/db/migration/` |
| `TemplateDtos.kt` | `backend/src/main/kotlin/com/datorio/model/dto/` |
| `TemplateService.kt` | `backend/src/main/kotlin/com/datorio/service/` |
| `TemplateController.kt` | `backend/src/main/kotlin/com/datorio/controller/` |

### Frontend (2)
| Файл | Куда |
|------|------|
| `templates.ts` | `frontend/src/api/` |
| `TemplateGalleryPage.tsx` | `frontend/src/components/templates/` |

## Патчи в существующих файлах (5)

### 1. ReportEntities.kt — добавить 2 поля

Файл: `backend/src/main/kotlin/com/datorio/model/ReportEntities.kt`

После строки 46 (`var thumbnailUrl: String? = null,`) добавить:

```kotlin
    @Column(name = "template_category", length = 100)
    var templateCategory: String? = null,

    @Column(name = "template_preview", columnDefinition = "TEXT")
    var templatePreview: String? = null,
```

### 2. ReportRepositories.kt — добавить 2 метода в ReportRepository

Файл: `backend/src/main/kotlin/com/datorio/repository/ReportRepositories.kt`

После строки 17 (`fun findByIsTemplateTrue(pageable: Pageable): Page<Report>`) добавить:

```kotlin
    fun findByIsTemplateTrueAndTemplateCategory(category: String, pageable: Pageable): Page<Report>

    @Query("SELECT DISTINCT r.templateCategory FROM Report r WHERE r.isTemplate = true AND r.templateCategory IS NOT NULL ORDER BY r.templateCategory")
    fun findDistinctTemplateCategories(): List<String>
```

### 3. SecurityConfig.kt — добавить endpoint

Файл: `backend/src/main/kotlin/com/datorio/config/SecurityConfig.kt`

После строки 48 (`.requestMatchers("/modeling/**").authenticated()`) добавить:

```kotlin
                    .requestMatchers("/templates/**").authenticated()
```

### 4. App.tsx — добавить роут

Файл: `frontend/src/App.tsx`

Добавить импорт (после строки 26 с ExplorePage):
```tsx
import TemplateGalleryPage from '@/components/templates/TemplateGalleryPage'
```

Добавить роут (после строки 58 с explore):
```tsx
          <Route path="/templates" element={<TemplateGalleryPage />} />
```

### 5. Sidebar.tsx — добавить пункт меню

Файл: `frontend/src/components/layout/Sidebar.tsx`

В строке 2 добавить `LayoutTemplate` в импорт lucide-react:
```tsx
import { ..., Boxes, LayoutTemplate } from 'lucide-react'
```

В массиве navItems после строки 12 (`{ to: '/models', icon: Boxes, label: 'Models' },`) добавить:
```tsx
  { to: '/templates', icon: LayoutTemplate, label: 'Templates' },
```

## API Endpoints

```
GET    /templates                        — список шаблонов (?category=...)
GET    /templates/categories             — список категорий
PUT    /templates/{id}/meta              — обновить category/preview/thumbnail
POST   /templates/{id}/mark              — пометить отчёт как шаблон
POST   /templates/{id}/unmark            — убрать из шаблонов
GET    /templates/export/{reportId}      — экспорт в JSON
POST   /templates/import                 — импорт из JSON
```

## Формат .datorio.json

```json
{
  "formatVersion": 1,
  "name": "Sales Dashboard",
  "description": "Monthly sales overview",
  "reportType": "STANDARD",
  "layout": "{...}",
  "settings": "{...}",
  "category": "Sales",
  "parameters": [
    { "name": "dateFrom", "paramType": "DATE", "isRequired": true, ... }
  ],
  "widgets": [
    { "widgetType": "CHART", "title": "Revenue", "chartConfig": "{...}", "position": "{...}", ... }
  ]
}
```

## Git commit

```
feat(phase22): template gallery with JSON export/import

- Template gallery UI with category filter tabs and card grid
- JSON export: any report → portable .datorio.json (no IDs/data)
- JSON import: .datorio.json → new report with optional datasource binding
- Mark/unmark reports as templates with categories
- V14 migration: template_category, template_preview columns
```
