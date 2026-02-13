# Phase 10 — Export & Distribution

## Overview

CSV / Excel / PDF export, email delivery, and iframe embedding with token auth.

## Files to copy

### Backend — new files

| File from archive | Destination |
|---|---|
| `V6__export_distribution.sql` | `backend/src/main/resources/db/migration/V6__export_distribution.sql` |
| `EmbedEntities.kt` | `backend/src/main/kotlin/com/datalens/model/EmbedEntities.kt` |
| `ExportDtos.kt` | `backend/src/main/kotlin/com/datalens/model/dto/ExportDtos.kt` |
| `EmbedTokenRepository.kt` | `backend/src/main/kotlin/com/datalens/repository/EmbedTokenRepository.kt` |
| `ExportService.kt` | `backend/src/main/kotlin/com/datalens/service/ExportService.kt` |
| `EmailService.kt` | `backend/src/main/kotlin/com/datalens/service/EmailService.kt` |
| `EmbedService.kt` | `backend/src/main/kotlin/com/datalens/service/EmbedService.kt` |
| `ExportController.kt` | `backend/src/main/kotlin/com/datalens/controller/ExportController.kt` |
| `EmbedController.kt` | `backend/src/main/kotlin/com/datalens/controller/EmbedController.kt` |

### Frontend — new files

| File from archive | Destination |
|---|---|
| `export.ts` | `frontend/src/api/export.ts` |
| `ExportMenu.tsx` | `frontend/src/components/reports/ExportMenu.tsx` |
| `EmbedViewerPage.tsx` | `frontend/src/components/embed/EmbedViewerPage.tsx` |

> Create folder: `frontend/src/components/embed/`

## Patches (4 existing files)

### Patch 1 — `backend/build.gradle.kts`

Add Jakarta Mail dependency. Find the `// ── Export ──` section:

```kotlin
    // ── Export ──
    implementation("org.apache.poi:poi-ooxml:5.3.0")  // Excel
    // PDF will be added in Phase 10
```

Replace with:

```kotlin
    // ── Export ──
    implementation("org.apache.poi:poi-ooxml:5.3.0")  // Excel
    implementation("jakarta.mail:jakarta.mail-api:2.1.3")
    implementation("org.eclipse.angus:angus-mail:2.0.3")
```

### Patch 2 — `backend/src/main/kotlin/com/datalens/config/SecurityConfig.kt`

Add embed endpoint to permitAll. Find:

```kotlin
                    .requestMatchers("/auth/**").permitAll()
                    .requestMatchers("/health").permitAll()
                    .requestMatchers("/docs/**").permitAll()
```

Add after `/docs/**`:

```kotlin
                    .requestMatchers("/embed/**").permitAll()
```

### Patch 3 — `frontend/src/App.tsx`

Add import:

```typescript
import EmbedViewerPage from '@/components/embed/EmbedViewerPage'
```

Add route OUTSIDE the `<Route element={<AppLayout />}>` block, as a sibling (embed pages have no sidebar/header):

```tsx
<Route path="/embed/:token" element={<EmbedViewerPage />} />
```

### Patch 4 — `frontend/src/components/reports/ReportViewerPage.tsx`

Add import at top:

```typescript
import ExportMenu from './ExportMenu'
```

Find the Snapshot button:

```tsx
          <button
            onClick={() => { reportApi.createSnapshot(Number(id)); toast.success('Snapshot created') }}
            className="btn-secondary text-sm"
          >
            <Camera className="w-4 h-4" /> Snapshot
          </button>
```

Add ExportMenu right AFTER it:

```tsx
          <ExportMenu reportId={Number(id)} reportName={report.name} />
```

### Patch 5 — `frontend/src/types/index.ts`

Add at the end:

```typescript
// ── Export ──

export interface ExportStatusResponse {
  snapshotId: number
  status: string
  format: string
  downloadUrl: string | null
}

export interface EmailDeliveryResponse {
  success: boolean
  recipientCount: number
  message: string
}

// ── Embed ──

export interface EmbedToken {
  id: number
  reportId: number
  reportName: string | null
  token: string
  label: string | null
  parameters: Record<string, unknown>
  embedUrl: string
  expiresAt: string | null
  isActive: boolean
  allowedDomains: string | null
  createdAt: string
}
```

## Application config (optional)

Add to `application.yml` if you want email delivery:

```yaml
datalens:
  email:
    enabled: false              # Set to true to enable
    smtp-host: smtp.gmail.com
    smtp-port: 587
    username: your-email@gmail.com
    password: app-password
    from: noreply@datalens.local
    use-tls: true
  export:
    directory: /tmp/datalens-exports
  embed:
    base-url: http://bobik1.rbt1.ru:8090
```

## API Endpoints

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/export/reports/{id}` | Download export (CSV/Excel/PDF) |
| `POST` | `/api/export/reports/{id}/save` | Export & save snapshot |
| `GET` | `/api/export/download/{snapshotId}` | Download saved export |
| `POST` | `/api/export/reports/{id}/email` | Send report via email |

### Embed

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/embed-tokens` | Yes | Create embed token |
| `GET` | `/api/embed-tokens/{id}` | Yes | Get token details |
| `GET` | `/api/embed-tokens/report/{id}` | Yes | List tokens for report |
| `DELETE` | `/api/embed-tokens/{id}` | Yes | Revoke token |
| `GET` | `/api/embed/{token}` | **No** | Render via token (public) |

### Embed Usage

```html
<iframe
  src="http://bobik1.rbt1.ru:8090/embed/YOUR_TOKEN?region=Europe"
  width="100%" height="600" frameborder="0">
</iframe>
```

## Commit and deploy

```bash
git add backend/src/main/resources/db/migration/V6__export_distribution.sql \
       backend/src/main/kotlin/com/datalens/model/EmbedEntities.kt \
       backend/src/main/kotlin/com/datalens/model/dto/ExportDtos.kt \
       backend/src/main/kotlin/com/datalens/repository/EmbedTokenRepository.kt \
       backend/src/main/kotlin/com/datalens/service/ExportService.kt \
       backend/src/main/kotlin/com/datalens/service/EmailService.kt \
       backend/src/main/kotlin/com/datalens/service/EmbedService.kt \
       backend/src/main/kotlin/com/datalens/controller/ExportController.kt \
       backend/src/main/kotlin/com/datalens/controller/EmbedController.kt \
       backend/build.gradle.kts \
       backend/src/main/kotlin/com/datalens/config/SecurityConfig.kt \
       frontend/src/api/export.ts \
       frontend/src/components/reports/ExportMenu.tsx \
       frontend/src/components/embed/EmbedViewerPage.tsx \
       frontend/src/App.tsx \
       frontend/src/components/reports/ReportViewerPage.tsx \
       frontend/src/types/index.ts

git commit -m "feat: Phase 10 — Export & Distribution (CSV/Excel/PDF, email, iframe embed)"
git push origin main
```
