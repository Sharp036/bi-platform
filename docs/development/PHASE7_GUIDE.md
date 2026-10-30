# Phase 7 — JavaScript Scripting Engine

## Overview

GraalJS-based scripting sandbox for data transformation, conditional formatting,
chart event handlers, and reusable script libraries. Includes backend engine with
timeout/memory limits, REST API, and frontend script editor with test runner.

## Architecture

```
Browser                         Server (container)
┌─────────────────────┐        ┌──────────────────────────┐
│ Script Editor       │        │ ScriptController         │
│   - code textarea   │──POST──│   ↓                      │
│   - test input      │  /api/ │ ScriptService            │
│   - output panel    │  scrip │   ↓                      │
│                     │  ts/   │ ScriptEngine (GraalJS)   │
│ Widget Renderer     │  exec  │   - sandboxed Context     │
│   - transform hook  │        │   - timeout enforcement  │
│   - format hook     │        │   - no IO, no threads    │
│   - event hooks     │        │   - console → logs       │
└─────────────────────┘        └──────────────────────────┘
```

## Files to copy

### Backend — new files

| File from archive | Destination |
|---|---|
| `V4__scripting_engine.sql` | `backend/src/main/resources/db/migration/V4__scripting_engine.sql` |
| `ScriptEntities.kt` | `backend/src/main/kotlin/com/datalens/model/ScriptEntities.kt` |
| `ScriptDtos.kt` | `backend/src/main/kotlin/com/datalens/model/dto/ScriptDtos.kt` |
| `ScriptRepositories.kt` | `backend/src/main/kotlin/com/datalens/repository/ScriptRepositories.kt` |
| `ScriptEngine.kt` | `backend/src/main/kotlin/com/datalens/scripting/ScriptEngine.kt` |
| `ScriptService.kt` | `backend/src/main/kotlin/com/datalens/service/ScriptService.kt` |
| `ScriptController.kt` | `backend/src/main/kotlin/com/datalens/controller/ScriptController.kt` |

> **Note:** Create folder `backend/src/main/kotlin/com/datalens/scripting/` for ScriptEngine.kt

### Frontend — new files

| File from archive | Destination |
|---|---|
| `scripts.ts` | `frontend/src/api/scripts.ts` |
| `ScriptEditorPage.tsx` | `frontend/src/components/scripts/ScriptEditorPage.tsx` |

> **Note:** Create folder `frontend/src/components/scripts/`

### Frontend — patches (edit existing files)

#### 1. `frontend/src/types/index.ts` — add at the end:

```typescript
// ── Scripts ──

export interface Script {
  id: number
  name: string
  description: string | null
  scriptType: 'TRANSFORM' | 'FORMAT' | 'EVENT' | 'LIBRARY'
  code: string
  isActive: boolean
  isLibrary: boolean
  tags: string[]
  config: Record<string, unknown>
  createdBy: number | null
  updatedBy: number | null
  createdAt: string
  updatedAt: string
}

export interface ScriptSummary {
  id: number
  name: string
  description: string | null
  scriptType: 'TRANSFORM' | 'FORMAT' | 'EVENT' | 'LIBRARY'
  isActive: boolean
  isLibrary: boolean
  tags: string[]
  updatedAt: string
}

export interface ScriptCreateRequest {
  name: string
  description?: string
  scriptType: Script['scriptType']
  code: string
  isLibrary?: boolean
  tags?: string[]
}

export interface ScriptUpdateRequest {
  name?: string
  description?: string
  scriptType?: Script['scriptType']
  code?: string
  isActive?: boolean
  isLibrary?: boolean
  tags?: string[]
}

export interface ScriptExecuteRequest {
  scriptId?: number
  code?: string
  input?: {
    columns: string[]
    rows: unknown[][]
    parameters: Record<string, unknown>
  }
  libraries?: number[]
}

export interface ScriptExecuteResponse {
  output: unknown
  columns: string[] | null
  rows: unknown[][] | null
  logs: string[]
  executionMs: number
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT'
}

export interface ScriptExecution {
  id: number
  scriptId: number | null
  scriptName: string | null
  contextType: string | null
  contextId: number | null
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT'
  executionMs: number | null
  inputRows: number | null
  outputRows: number | null
  errorMessage: string | null
  executedBy: string | null
  createdAt: string
}
```

#### 2. `frontend/src/App.tsx` — add import and route:

```typescript
// Add import:
import ScriptEditorPage from '@/components/scripts/ScriptEditorPage'

// Add route inside <Route element={<AppLayout />}>:
<Route path="/scripts" element={<ScriptEditorPage />} />
```

#### 3. `frontend/src/components/layout/Sidebar.tsx` — add nav item:

```typescript
// Add to imports:
import { Code2 } from 'lucide-react'

// Add to NAV_ITEMS array (after Queries):
{ path: '/scripts', label: 'Scripts', icon: Code2 },
```

## Commit and deploy

```bash
git add backend/src/main/resources/db/migration/V4__scripting_engine.sql \
       backend/src/main/kotlin/com/datalens/model/ScriptEntities.kt \
       backend/src/main/kotlin/com/datalens/model/dto/ScriptDtos.kt \
       backend/src/main/kotlin/com/datalens/repository/ScriptRepositories.kt \
       backend/src/main/kotlin/com/datalens/scripting/ \
       backend/src/main/kotlin/com/datalens/service/ScriptService.kt \
       backend/src/main/kotlin/com/datalens/controller/ScriptController.kt \
       frontend/src/api/scripts.ts \
       frontend/src/components/scripts/ \
       frontend/src/types/index.ts \
       frontend/src/App.tsx \
       frontend/src/components/layout/Sidebar.tsx \
       PHASE7_GUIDE.md

git commit -m "feat: Phase 7 — JavaScript Scripting Engine (GraalJS)"
git push origin main
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/scripts` | List scripts (search, type filter, paging) |
| `GET` | `/api/scripts/libraries` | List library scripts |
| `GET` | `/api/scripts/{id}` | Get script by ID |
| `POST` | `/api/scripts` | Create script |
| `PUT` | `/api/scripts/{id}` | Update script |
| `DELETE` | `/api/scripts/{id}` | Soft-delete script |
| `POST` | `/api/scripts/execute` | Execute ad-hoc or saved script |
| `POST` | `/api/scripts/{id}/execute` | Execute script by ID |
| `GET` | `/api/scripts/{id}/executions` | Script execution history |
| `GET` | `/api/scripts/executions/recent` | Recent executions |

## Script API (available inside scripts)

| Variable/Function | Description |
|---|---|
| `data` | Array of objects from query results |
| `params` | Report/widget parameters |
| `setOutput(newData)` | Set transformed output data |
| `console.log(...)` | Captured to execution logs |

## Sandbox Security

- **No Java access** — HostAccess.NONE, no class lookup
- **No I/O** — filesystem, network, environment blocked
- **No threads** — single-threaded execution
- **Timeout** — configurable via `datalens.scripting.timeout-ms` (default 5s)
- **Statement limit** — configurable via `datalens.scripting.max-statements`
- **Console capture** — console.log → execution logs

## What doesn't change

| File | Status |
|------|--------|
| `Dockerfile` | No changes |
| `.gitlab-ci.yml` | No changes |
| `docker-compose.prod.yml` | No changes |
| `build.gradle.kts` | No changes (GraalJS deps already there) |
| `application.yml` | No changes (scripting config already there) |
