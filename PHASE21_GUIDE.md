# Phase 21 — Data Modeling Layer (Semantic Layer)

## Обзор

Семантический слой поверх SQL: dimensions/measures, relationships между таблицами, автоматические JOIN-ы, Explore-интерфейс для построения запросов без SQL.

## Новые файлы (10 файлов)

### Backend (6)
| Файл | Куда |
|------|------|
| `V13__data_modeling.sql` | `backend/src/main/resources/db/migration/` |
| `ModelEntities.kt` | `backend/src/main/kotlin/com/datorio/model/` |
| `ModelDtos.kt` | `backend/src/main/kotlin/com/datorio/model/dto/` |
| `ModelRepositories.kt` | `backend/src/main/kotlin/com/datorio/repository/` |
| `ModelService.kt` | `backend/src/main/kotlin/com/datorio/service/` |
| `ModelController.kt` | `backend/src/main/kotlin/com/datorio/controller/` |

### Frontend (4)
| Файл | Куда |
|------|------|
| `modeling.ts` | `frontend/src/api/` |
| `ModelListPage.tsx` | `frontend/src/components/modeling/` |
| `ModelEditorPage.tsx` | `frontend/src/components/modeling/` |
| `ExplorePage.tsx` | `frontend/src/components/modeling/` |

## Патчи в существующих файлах

### 1. SecurityConfig.kt — добавить `/modeling/**`

После строки:
```kotlin
.requestMatchers("/visualization/**").authenticated()
```
Добавить:
```kotlin
.requestMatchers("/modeling/**").authenticated()
```

### 2. App.tsx — добавить роуты

Добавить импорт:
```tsx
import ModelListPage from '@/components/modeling/ModelListPage'
import ModelEditorPage from '@/components/modeling/ModelEditorPage'
import ExplorePage from '@/components/modeling/ExplorePage'
```

После строки `<Route path="/shared" element={<SharedWithMePage />} />` добавить:
```tsx
<Route path="/models" element={<ModelListPage />} />
<Route path="/models/:id" element={<ModelEditorPage />} />
<Route path="/explore/:modelId" element={<ExplorePage />} />
```

### 3. Sidebar.tsx — добавить пункт меню

Добавить в импорт:
```tsx
import { ..., Boxes } from 'lucide-react'
```

В массиве `navItems` после `{ to: '/datasources', icon: Database, label: 'Data Sources' },` добавить:
```tsx
{ to: '/models', icon: Boxes, label: 'Models' },
```

## Возможности

### Data Model
- Создание/редактирование/удаление моделей
- Привязка к DataSource
- Publish/draft статус

### Tables & Fields
- **Auto-Import**: выбираете таблицы из схемы → система сама создаёт fields и определяет роли
- **Field Roles**: DIMENSION, MEASURE, TIME_DIMENSION (auto-detected по типам колонок)
- **Aggregation**: SUM, AVG, COUNT, COUNT_DISTINCT, MIN, MAX для measures
- **Hidden fields**: скрыть от Explore (ID, FK и т.д.)
- **Custom Expression**: SQL-выражение вместо простого column_name

### Relationships (Auto-JOIN)
- **Auto-detect**: по naming convention `<table>_id` → ищет таблицу `<table>` или `<table>s`
- JOIN type: LEFT, INNER, RIGHT, FULL
- При Explore система автоматически строит JOIN path между нужными таблицами (BFS по графу relationships)

### Explore (No-SQL Query Builder)
- Выбираете fields из левой панели → они становятся колонками запроса
- Dimensions → GROUP BY, Measures → агрегация (SUM, AVG...)
- Фильтры: =, ≠, >, ≥, <, ≤, LIKE, IS NULL, IS NOT NULL
- Сортировка ASC/DESC
- Просмотр сгенерированного SQL
- Результат в таблице с count rows и execution time

## API Endpoints

```
GET    /modeling/models                        — список моделей
GET    /modeling/models/{id}                   — детали модели
POST   /modeling/models                        — создать модель
PUT    /modeling/models/{id}                   — обновить модель
DELETE /modeling/models/{id}                   — удалить модель

POST   /modeling/models/{id}/tables            — добавить таблицу
DELETE /modeling/tables/{tableId}              — удалить таблицу

POST   /modeling/tables/{tableId}/fields       — добавить поле
PUT    /modeling/fields/{fieldId}              — обновить поле
DELETE /modeling/fields/{fieldId}              — удалить поле

POST   /modeling/models/{id}/relationships     — добавить relationship
DELETE /modeling/relationships/{relId}         — удалить relationship

POST   /modeling/models/{id}/auto-import       — авто-импорт таблиц из schema
POST   /modeling/explore                       — выполнить explore-запрос
```

## Таблицы БД

- `dl_data_model` — модели (name, datasource_id, owner_id, is_published)
- `dl_model_table` — таблицы в модели (table_name, alias, is_primary, sql_expression)
- `dl_model_field` — поля (column_name, field_role, aggregation, expression, format, hidden)
- `dl_model_relationship` — связи (left/right table+column, join_type)

## Git commit

```
feat(phase21): data modeling layer — semantic model with auto-JOIN

- DataModel/ModelTable/ModelField/ModelRelationship entities
- Auto-import tables from datasource schema with field role detection
- Auto-detect relationships by FK naming convention (<table>_id)
- Explore query builder: select fields → auto-build SQL with JOINs
- BFS join path resolution across relationship graph
- ModelListPage, ModelEditorPage, ExplorePage frontend
- REST API under /modeling/**
```
