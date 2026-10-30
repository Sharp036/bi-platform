# Datorio — Business Intelligence Platform

## Vision
Модульная BI-платформа с открытым исходным кодом, развёртываемая в Docker,
с поддержкой PostgreSQL и ClickHouse, встроенным JavaScript-скриптингом
для настройки поведения элементов отчётов, drill-down навигацией и ролевой моделью доступа.

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend | Kotlin 1.9 + Spring Boot 3.x | JVM enterprise ecosystem, coroutines, null-safety |
| Frontend | React 18 + TypeScript | Стандарт для интерактивных SPA |
| Charts | Apache ECharts 5 | Drill-down, rich API, 40+ chart types |
| Scripting | GraalJS (backend) + eval-free sandbox (frontend) | JS как единый язык скриптов |
| Auth | Spring Security + JWT | Ролевая модель, stateless |
| DB Connectors | JDBC (PostgreSQL, ClickHouse) | Универсальные коннекторы |
| Caching | Caffeine (in-process) + Redis (optional) | Кэширование результатов запросов |
| Build | Gradle (Kotlin DSL) | Современный, гибкий |
| Containerization | Docker + Docker Compose | Single-command deployment |
| CI/CD | GitLab CI + GitHub Actions | Dual-repo strategy |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser (React + TS)              │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐    │
│  │ Dashboard │ │ Report   │ │ Report Designer   │    │
│  │ Viewer   │ │ Builder  │ │ (drag & drop)     │    │
│  └──────────┘ └──────────┘ └───────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │ ECharts + JS Scripting Sandbox               │    │
│  └──────────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────────┘
                        │ REST API / WebSocket
┌───────────────────────┴─────────────────────────────┐
│               Spring Boot Backend (Kotlin)           │
│  ┌────────────┐ ┌────────────┐ ┌─────────────────┐  │
│  │ Auth &     │ │ Query      │ │ Report           │  │
│  │ RBAC       │ │ Engine     │ │ Engine           │  │
│  │ Module     │ │            │ │                   │  │
│  └────────────┘ └────────────┘ └─────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌─────────────────┐  │
│  │ DataSource │ │ Scripting  │ │ Export            │  │
│  │ Manager    │ │ Engine     │ │ (PDF/Excel/CSV)   │  │
│  │            │ │ (GraalJS)  │ │                   │  │
│  └────────────┘ └────────────┘ └─────────────────┘  │
└───────┬───────────────┬─────────────────────────────┘
        │               │
   ┌────┴────┐    ┌─────┴──────┐
   │PostgreSQL│    │ ClickHouse │
   └─────────┘    └────────────┘
```

---

## Phase Plan (23 phases)

> Status: all 23 phases are implemented. The plan below was the original
> 12-phase scope; phases 13-23 were added as the platform grew. Each phase
> has a completion commit, and most have a `PHASE*_GUIDE.md` integration guide.

### Phase 1 — Project Skeleton & DevOps ✅
- [x] Kotlin + Spring Boot project structure (Gradle)
- [x] Docker & Docker Compose setup
- [x] Multi-stage Dockerfile (build + runtime)
- [x] GitLab CI pipeline `.gitlab-ci.yml`
- [x] GitHub Actions workflow
- [x] README with setup instructions
- [x] Basic health-check endpoint

### Phase 2 — Data Source Connections ✅
- [x] DataSource entity & CRUD API
- [x] PostgreSQL connector (HikariCP connection pool)
- [x] ClickHouse connector (clickhouse-jdbc)
- [x] Connection testing endpoint
- [x] Dynamic query execution with parameterized queries
- [x] SQL injection protection (prepared statements)
- [x] Connection pool management & monitoring

### Phase 3 — Authentication & RBAC ✅
- [x] User entity (username, email, password hash)
- [x] Role entity (ADMIN, EDITOR, VIEWER + custom roles)
- [x] JWT authentication (access + refresh tokens)
- [x] Login / Register / Refresh endpoints
- [x] Permission model: datasource-level, report-level, row-level
- [x] API endpoint security with `@PreAuthorize`
- [x] Admin panel for user/role management

### Phase 4 — Query Builder & Metadata ✅
- [x] Schema introspection (tables, columns, types)
- [x] Visual query builder API (select, join, filter, group, sort)
- [x] Query to SQL compiler (dialect-aware: PG vs CH)
- [x] Query result pagination & streaming
- [x] Saved queries (with versioning)
- [x] Query execution audit log

### Phase 5 — Report Engine (Core) ✅
- [x] Report entity model (JSON-based definition)
- [x] Report ↔ DataSource ↔ Query associations
- [x] Report parameter system (date ranges, filters, dropdowns)
- [x] Report template CRUD API
- [x] Server-side report rendering (data + layout)
- [x] Report scheduling (cron-based)

### Phase 6 — Frontend: Dashboard & Report Viewer ✅
- [x] React app scaffolding (Vite + TypeScript)
- [x] Authentication UI (login, session management)
- [x] Dashboard grid layout (react-grid-layout)
- [x] ECharts integration (bar, line, pie, table, KPI cards)
- [x] Report parameter panel (date pickers, dropdowns)
- [x] Auto-refresh (live push delivered via Server-Sent Events in Phase 23)
- [x] Responsive design (desktop + tablet)

### Phase 7 — JavaScript Scripting Engine ✅
- [x] GraalJS sandbox on backend (timeout, memory limits)
- [x] Frontend JS sandbox (Function constructor, no eval)
- [x] Script editor with Monaco Editor (IntelliSense)
- [x] Chart event hooks: `onClick`, `onDataLoaded`, `onRender`
- [x] Data transformation scripts (pre/post-processing)
- [x] Conditional formatting via scripts
- [x] Script library (reusable snippets)
- [x] Script API: `chart.setOption()`, `report.setParameter()`, `data.filter()`

### Phase 8 — Drill-Down Reports ✅
- [x] Drill-down action model (click → navigate to child report)
- [x] Parameter passing between reports
- [x] Breadcrumb navigation
- [x] Drill-through (row click → detail report)
- [x] Drill-down in charts (ECharts tree/sunburst/treemap)
- [x] Cross-report linking with context preservation
- [x] Back-navigation with state restoration

### Phase 9 — Report Designer (Visual) ✅
- [x] Drag-and-drop report canvas
- [x] Component palette (charts, tables, text, images, shapes)
- [x] Property panel per component
- [x] Data binding UI (drag field → axis/measure)
- [x] Layout: free-form + grid + banded (header/detail/footer)
- [x] Preview mode with live data
- [x] Undo/redo system

### Phase 10 — Export & Distribution ✅
- [x] PDF export (server-side via Playwright or wkhtmltopdf)
- [x] Excel export (Apache POI)
- [x] CSV export
- [x] Scheduled email delivery (SMTP)
- [x] Report snapshots (point-in-time archives)
- [x] Embedding API (iframe with token auth)

### Phase 11 — Advanced Features ✅
- [x] Calculated fields & measures (DAX-like expressions)
- [x] Data alerts (threshold → notification)
- [x] Dashboard filters (global cross-filtering)
- [x] Bookmarks (saved filter states)
- [x] Row-level security (RLS)
- [x] Multi-tenancy support
- [x] Localization (i18n)

### Phase 12 — Performance & Scale ✅
- [x] Query result caching (Caffeine in-process; Redis optional)
- [x] Materialized view management
- [x] Query optimization advisor (EXPLAIN-based)
- [x] Connection pooling tuning
- [x] Frontend lazy loading & virtualization
- [x] Horizontal scaling (multiple backend instances)
- [x] Monitoring (custom Prometheus metrics + system dashboard)

### Phase 13 — Interactive Dashboards ✅
- [x] Chart layers with dual axis + per-layer visibility toggle
- [x] Dashboard cross-filter / highlight actions
- [x] Dynamic zone visibility rules
- [x] Floating overlays (logos, images, text)
- See [PHASE13_GUIDE.md](PHASE13_GUIDE.md)

### Phase 14 — User Management & Admin Panel ✅
- [x] Admin UI for users and roles
- [x] Create / edit / delete users, assign roles
- Delivered in commit `8d39874` (no separate guide)

### Phase 15 — Object-Level Permissions & Sharing ✅
- [x] Activate `dl_object_permission` (per-object grants)
- [x] Share reports / dashboards / datasources with users or roles
- See [PHASE15_GUIDE.md](PHASE15_GUIDE.md)

### Phase 16 — Favorites, Recent Items & Folders ✅
- [x] Favorite / unfavorite objects
- [x] Recent items tracking
- [x] Folder organization
- See [PHASE16_GUIDE.md](PHASE16_GUIDE.md)

### Phase 17 — Tags & Global Search ✅
- [x] Tagging of objects
- [x] Global search across reports / dashboards / datasources
- See [PHASE17_GUIDE.md](PHASE17_GUIDE.md)

### Phase 18 — Button Widgets, Parameter Controls, Global Filters ✅
- [x] Button widgets (show/hide, navigate, filter, URL, export)
- [x] Parameter control widgets
- [x] Global dashboard filters
- See [PHASE18_GUIDE.md](PHASE18_GUIDE.md)

### Phase 19 — Enhanced Tooltips, Annotations, Containers, Dashboard Objects ✅
- [x] Rich configurable tooltips
- [x] Chart annotations
- [x] Container widgets
- [x] Additional dashboard objects
- See [PHASE19_GUIDE.md](PHASE19_GUIDE.md)

### Phase 20 — Extended Chart Types ✅
- [x] 12 additional chart types (scatter, waterfall, heatmap, boxplot, candlestick, etc.)
- See [PHASE20_GUIDE.md](PHASE20_GUIDE.md)

### Phase 21 — Data Modeling Layer (Semantic Layer) ✅
- [x] Dimensions / measures defined over SQL
- [x] Table relationships with automatic JOINs
- [x] Explore interface for SQL-free query building
- See [PHASE21_GUIDE.md](PHASE21_GUIDE.md)

### Phase 22 — Dashboard Templates & Marketplace ✅
- [x] Template gallery with categories
- [x] JSON export / import of report configs (`.datorio.json`)
- See [PHASE22_GUIDE.md](PHASE22_GUIDE.md)

### Phase 23 — Real-time & Streaming ✅
- [x] Push dashboard updates via Server-Sent Events (SSE)
- [x] No extra dependencies (`SseEmitter` + `fetch`/`ReadableStream`)
- See [PHASE23_GUIDE.md](PHASE23_GUIDE.md)

---

## Git Strategy (Dual-Repo)

### GitLab (Organization) — primary development
```
origin → gitlab.yourcompany.com/team/datalens-bi
```

### GitHub (Portfolio / Open Source)
```
github → github.com/yourusername/datalens-bi
```

### Sync Strategy
```bash
# Add both remotes
git remote add origin git@gitlab.yourcompany.com:team/datalens-bi.git
git remote add github git@github.com:yourusername/datalens-bi.git

# Push to both
git push origin main
git push github main

# Or use a single push command
git remote set-url --add --push origin git@gitlab.yourcompany.com:team/datalens-bi.git
git remote set-url --add --push origin git@github.com:yourusername/datalens-bi.git
```

---

## Quick Start (after Phase 1)

```bash
# Clone
git clone git@github.com:yourusername/datalens-bi.git
cd datalens-bi

# Run with Docker Compose (includes sample PG + CH)
docker-compose up -d

# Access
# API: http://localhost:8080
# UI:  http://localhost:3000 (from Phase 6+)
```
