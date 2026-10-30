# Phase 16 — Favorites, Recent Items & Folders

## Новые файлы

### Backend

| Файл из архива | Куда копировать |
|------|------------|
| `backend/V9__favorites_folders.sql` | `backend/src/main/resources/db/migration/V9__favorites_folders.sql` |
| `backend/WorkspaceEntities.kt` | `backend/src/main/kotlin/com/datorio/model/WorkspaceEntities.kt` |
| `backend/WorkspaceDtos.kt` | `backend/src/main/kotlin/com/datorio/model/dto/WorkspaceDtos.kt` |
| `backend/WorkspaceRepositories.kt` | `backend/src/main/kotlin/com/datorio/repository/WorkspaceRepositories.kt` |
| `backend/WorkspaceService.kt` | `backend/src/main/kotlin/com/datorio/service/WorkspaceService.kt` |
| `backend/WorkspaceController.kt` | `backend/src/main/kotlin/com/datorio/controller/WorkspaceController.kt` |

### Frontend

| Файл из архива | Куда копировать |
|------|------------|
| `frontend/workspace.ts` | `frontend/src/api/workspace.ts` |
| `frontend/FavoriteButton.tsx` | `frontend/src/components/workspace/FavoriteButton.tsx` |
| `frontend/WorkspacePage.tsx` | `frontend/src/components/workspace/WorkspacePage.tsx` |

---

## Патчи существующих файлов

### 1. `backend/src/main/kotlin/com/datorio/config/SecurityConfig.kt`

Добавить ДО строки `.anyRequest().authenticated()`:
```kotlin
                    .requestMatchers("/workspace/**").authenticated()
```

### 2. `frontend/src/App.tsx`

Добавить импорт:
```tsx
import WorkspacePage from '@/components/workspace/WorkspacePage'
```

Заменить роут главной страницы:
```tsx
          <Route path="/" element={<WorkspacePage />} />
```
(было `<DashboardPage />`, стало `<WorkspacePage />`)

### 3. `frontend/src/components/layout/Sidebar.tsx`

В импорт lucide-react добавить: `Home`

Заменить первый элемент в `navItems`:
```tsx
  { to: '/', icon: Home, label: 'Home' },
```
(было `LayoutDashboard` и `'Dashboards'`)

### 4. `frontend/src/components/reports/ReportListPage.tsx`

Добавить импорт:
```tsx
import FavoriteButton from '@/components/workspace/FavoriteButton'
```

В карточку отчёта (рядом с названием или в action-кнопках) добавить:
```tsx
<FavoriteButton objectType="REPORT" objectId={r.id} />
```

### 5. `frontend/src/components/reports/ReportViewerPage.tsx`

Добавить импорт:
```tsx
import { workspaceApi } from '@/api/workspace'
import FavoriteButton from '@/components/workspace/FavoriteButton'
```

В useEffect загрузки отчёта добавить трекинг просмотра:
```tsx
workspaceApi.trackView('REPORT', reportId)
```

В заголовок отчёта добавить кнопку:
```tsx
<FavoriteButton objectType="REPORT" objectId={reportId} />
```

---

## Git Commit

```bash
git add -A
git commit -m "feat(phase16): favorites, recent items & folders

- Star/unstar any object (reports, datasources, dashboards)
- Track recently viewed items with view count
- Virtual folders with tree structure
- Workspace home page (favorites grid, recent list, folder browser)
- Reusable FavoriteButton component
- V9 migration for new tables"

git push origin main
git push github main
```
