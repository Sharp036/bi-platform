# Phase 23 — Real-time & Streaming (SSE)

## Обзор

Push-обновления дашбордов через Server-Sent Events (SSE). Без дополнительных зависимостей — `SseEmitter` (Spring) + `fetch/ReadableStream` (браузер).

## Новые файлы (6)

### Backend (3)
| Файл | Куда |
|------|------|
| `AsyncConfig.kt` | `backend/src/main/kotlin/com/datorio/config/` |
| `LiveDataService.kt` | `backend/src/main/kotlin/com/datorio/service/` |
| `LiveDataController.kt` | `backend/src/main/kotlin/com/datorio/controller/` |

### Frontend (3)
| Файл | Куда |
|------|------|
| `live.ts` | `frontend/src/api/` |
| `useLiveData.ts` | `frontend/src/hooks/` |
| `LiveIndicator.tsx` | `frontend/src/components/reports/` |

## Патчи в существующих файлах (3)

### 1. JwtAuthenticationFilter.kt — поддержка token в query params для SSE

Файл: `backend/src/main/kotlin/com/datorio/security/JwtAuthenticationFilter.kt`

Заменить метод `extractToken`:

```kotlin
    private fun extractToken(request: HttpServletRequest): String? {
        val header = request.getHeader("Authorization")
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7)
        }
        // Fallback: token as query parameter (for SSE EventSource)
        if (request.requestURI.startsWith("/live/")) {
            return request.getParameter("token")
        }
        return null
    }
```

### 2. ReportRenderService.kt — push уведомление после рендера

Файл: `backend/src/main/kotlin/com/datorio/service/ReportRenderService.kt`

Добавить зависимость (в конструктор, после `objectMapper`):

```kotlin
    private val liveDataService: LiveDataService
```

В конце метода `renderReport()`, перед `return`, добавить:

```kotlin
        // Push to live subscribers
        try { liveDataService.notifyReportUpdate(reportId, response) } catch (_: Exception) {}
```

Т.е. итоговый хвост метода:

```kotlin
        val response = RenderReportResponse(
            reportId = report.id,
            reportName = report.name,
            parameters = resolvedParams,
            widgets = renderedWidgets,
            executionMs = totalMs
        )

        // Push to live subscribers
        try { liveDataService.notifyReportUpdate(reportId, response) } catch (_: Exception) {}

        return response
```

### 3. ReportViewerPage.tsx — добавить Live-кнопку

Файл: `frontend/src/components/reports/ReportViewerPage.tsx`

Добавить импорты:

```tsx
import { useLiveData } from '@/hooks/useLiveData'
import LiveIndicator from './LiveIndicator'
```

Добавить state и hook (после `const initializedRef = useRef(false)`):

```tsx
  const [liveEnabled, setLiveEnabled] = useState(false)
  const { status: liveStatus, lastUpdate: liveLastUpdate, reconnect: liveReconnect } = useLiveData({
    enabled: liveEnabled,
    reportId: currentReportId,
    onReportUpdate: () => handleRender(),
  })
```

Добавить LiveIndicator в toolbar (перед `<Clock>` auto-refresh):

```tsx
          <LiveIndicator
            status={liveStatus}
            lastUpdate={liveLastUpdate}
            enabled={liveEnabled}
            onToggle={setLiveEnabled}
            onReconnect={liveReconnect}
          />
```

## Архитектура

```
┌──────────────┐     fetch + Auth header      ┌──────────────┐
│  Browser      │ ◄──── SSE stream ──────────  │  Spring Boot  │
│               │                               │               │
│  useLiveData  │   GET /live/subscribe         │ LiveDataCtrl  │
│  hook         │   ?reportId=5                 │   ↓           │
│     ↓         │                               │ SseEmitter    │
│  LiveIndicator│                               │   ↑           │
│  component    │                               │ LiveDataSvc   │
│               │                               │   ↑           │
│  auto re-     │                               │ RenderService │
│  render()     │                               │ (after render) │
└──────────────┘                               └──────────────┘
```

## SSE Events

| Event | Когда | Payload |
|-------|-------|---------|
| `connected` | При подключении | `{ reportId, message }` |
| `report-update` | После render | `{ reportId, widgetCount, executionMs, timestamp }` |
| `widget-update` | Точечное обновление | `{ reportId, widgetId, data, timestamp }` |
| `manual-refresh` | POST /live/push | custom payload |
| `heartbeat` | Каждые 25с | `{ ts }` |

## API Endpoints

```
GET    /live/subscribe?reportId=X         — SSE stream (text/event-stream)
GET    /live/subscribe?reportId=X&token=Y — SSE с token в query (для EventSource)
POST   /live/push/{reportId}              — ручной push всем подписчикам
GET    /live/stats                        — статистика подписок
DELETE /live/disconnect/{reportId}        — отключить всех подписчиков
```

## Как это работает

1. Пользователь нажимает **Live** в toolbar отчёта
2. `useLiveData` hook открывает `fetch()` к `/live/subscribe?reportId=X` с JWT header
3. Сервер возвращает `text/event-stream` через `SseEmitter`
4. Когда кто-то рендерит этот отчёт (вручную, по расписанию, другой пользователь) — `ReportRenderService` вызывает `liveDataService.notifyReportUpdate()`
5. Все подписчики получают SSE event `report-update`
6. `useLiveData.onReportUpdate` вызывает `handleRender()` — данные обновляются
7. `LiveIndicator` показывает зелёный пульсирующий индикатор и время последнего обновления
8. Heartbeat каждые 25с поддерживает соединение
9. При разрыве — автоматический reconnect с exponential backoff

## Git commit

```
feat(phase23): real-time dashboard updates via SSE

- LiveDataService: SSE subscription manager with heartbeat + broadcast
- LiveDataController: subscribe/push/stats/disconnect endpoints
- AsyncConfig: thread pool for SSE connections
- useLiveData hook: fetch-based SSE client with JWT auth + auto-reconnect
- LiveIndicator: connection status UI component
- Integration: ReportRenderService pushes to subscribers after render
- JWT token query param support for /live/ endpoints
```
