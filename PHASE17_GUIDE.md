# Phase 17 — Tags & Global Search

## Новые файлы

### Backend

| Файл | Назначение |
|------|-----------|
| `V10__tags_search.sql` | `backend/src/main/resources/db/migration/` |
| `TagEntities.kt` | `backend/src/main/kotlin/com/datorio/model/` |
| `TagSearchDtos.kt` | `backend/src/main/kotlin/com/datorio/model/dto/` |
| `TagSearchRepositories.kt` | `backend/src/main/kotlin/com/datorio/repository/` |
| `TagSearchService.kt` | `backend/src/main/kotlin/com/datorio/service/` |
| `TagSearchController.kt` | `backend/src/main/kotlin/com/datorio/controller/` |

### Frontend

| Файл | Назначение | Создать папку |
|------|-----------|:---:|
| `tagsearch.ts` | `frontend/src/api/` | — |
| `GlobalSearchBar.tsx` | `frontend/src/components/search/` | ✅ |
| `TagManager.tsx` | `frontend/src/components/tags/` | ✅ |

---

## Патчи

### 1. SecurityConfig.kt

Файл: `backend/src/main/kotlin/com/datorio/config/SecurityConfig.kt`

Найти:
```kotlin
                    .requestMatchers("/workspace/**").authenticated()
```
Добавить ПОСЛЕ:
```kotlin
                    .requestMatchers("/tags/**").authenticated()
                    .requestMatchers("/search/**").authenticated()
```

---

### 2. Header.tsx

Файл: `frontend/src/components/layout/Header.tsx`

Добавить импорт:
```tsx
import GlobalSearchBar from '@/components/search/GlobalSearchBar'
```

Найти пустой `<div />` (placeholder в левой части хедера):
```tsx
      <div />
```
Заменить на:
```tsx
      <GlobalSearchBar />
```

---

### 3. ReportListPage.tsx

Файл: `frontend/src/components/reports/ReportListPage.tsx`

Добавить импорт:
```tsx
import TagManager from '@/components/tags/TagManager'
```

В карточке отчёта, найти блок с метаданными (widgets · params · date). Добавить ПОСЛЕ него `TagManager`. Найти:
```tsx
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-3">
                <span>{r.widgets?.length || 0} widgets</span>
                <span>·</span>
                <span>{r.parameters?.length || 0} params</span>
                <span>·</span>
                <span>{new Date(r.updatedAt).toLocaleDateString()}</span>
              </div>
```
Добавить СРАЗУ ПОСЛЕ этого `</div>`:
```tsx
              <div className="mb-2">
                <TagManager objectType="REPORT" objectId={r.id} compact />
              </div>
```

---

## Git Commit

```bash
git add -A
git commit -m "feat(phase17): tags & global search

- Tag CRUD (create, rename, color, delete)
- Assign/remove tags on any object
- Global search across reports, datasources, queries
- Keyboard shortcut Ctrl+K for search
- Search results with tag badges and relevance scoring
- TagManager inline component for report cards
- V10 migration for tag tables"

git push origin main
git push github main
```
