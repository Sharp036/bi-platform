# Phase 15 — Object-Level Permissions & Sharing

Активирует существующую таблицу `dl_object_permission` из V1 миграции.
Даёт возможность шарить отчёты/дашборды/datasources с конкретными пользователями или ролями.

## Новые файлы

### Backend

| Файл из архива | Куда копировать |
|------|------------|
| `backend/ObjectPermission.kt` | `backend/src/main/kotlin/com/datorio/model/ObjectPermission.kt` |
| `backend/SharingDtos.kt` | `backend/src/main/kotlin/com/datorio/model/dto/SharingDtos.kt` |
| `backend/ObjectPermissionRepository.kt` | `backend/src/main/kotlin/com/datorio/repository/ObjectPermissionRepository.kt` |
| `backend/ObjectPermissionService.kt` | `backend/src/main/kotlin/com/datorio/service/ObjectPermissionService.kt` |
| `backend/SharingController.kt` | `backend/src/main/kotlin/com/datorio/controller/SharingController.kt` |

### Frontend

| Файл из архива | Куда копировать |
|------|------------|
| `frontend/sharing.ts` | `frontend/src/api/sharing.ts` |
| `frontend/ShareDialog.tsx` | `frontend/src/components/sharing/ShareDialog.tsx` |
| `frontend/SharedWithMePage.tsx` | `frontend/src/components/sharing/SharedWithMePage.tsx` |

---

## Патчи существующих файлов

### 1. `backend/src/main/kotlin/com/datorio/config/SecurityConfig.kt`
Добавить ДО строки `.anyRequest().authenticated()`:
```kotlin
.requestMatchers("/sharing/**").authenticated()
```

### 2. `frontend/src/App.tsx`
Добавить импорт:
```tsx
import SharedWithMePage from '@/components/sharing/SharedWithMePage'
```
Добавить роут внутри `<Route element={<AppLayout />}>`:
```tsx
<Route path="/shared" element={<SharedWithMePage />} />
```

### 3. `frontend/src/components/layout/Sidebar.tsx`
В импорт lucide-react добавить: `Share2`
В массив `navItems` добавить (перед Administration):
```tsx
{ to: '/shared', icon: Share2, label: 'Shared with Me' },
```

### 4. `frontend/src/components/reports/ReportListPage.tsx`
Добавить кнопку Share в карточку отчёта.

Импорт вверху:
```tsx
import { Share2 } from 'lucide-react'
import ShareDialog from '@/components/sharing/ShareDialog'
```

Добавить стейт в компонент (после других useState):
```tsx
const [shareReport, setShareReport] = useState<Report | null>(null)
```

Добавить кнопку в карточке (рядом с другими action-кнопками):
```tsx
<button onClick={(e) => { e.preventDefault(); setShareReport(r) }}
  className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-dark-surface-100"
  title="Share">
  <Share2 className="w-4 h-4 text-slate-400" />
</button>
```

Добавить диалог перед закрывающим `</div>` компонента:
```tsx
{shareReport && (
  <ShareDialog
    objectType="REPORT"
    objectId={shareReport.id}
    objectName={shareReport.name}
    onClose={() => setShareReport(null)}
  />
)}
```

---

## API Endpoints

### Sharing (`/api/sharing`)
- `GET /{objectType}/{objectId}` — список всех shares объекта
- `POST /grant` — предоставить доступ (user или role)
- `POST /bulk-grant` — массовое предоставление доступа
- `POST /revoke` — отозвать доступ
- `GET /shared-with-me` — объекты, расшаренные текущему пользователю
- `GET /{objectType}/{objectId}/my-access` — мой уровень доступа к объекту

### Access Levels
- `VIEW` — только просмотр
- `EDIT` — просмотр + редактирование
- `ADMIN` — полный доступ + управление шарингом

---

## Git Commit
```bash
git add -A
git commit -m "feat(phase15): object-level permissions & sharing

- ObjectPermission entity (activates dl_object_permission table)
- Share objects with users or roles (VIEW/EDIT/ADMIN)
- Bulk grant, revoke, access level check
- ShareDialog component for report/dashboard sharing
- Shared With Me page
- Audit logging for share/revoke actions"

git push origin main
git push github main
```
