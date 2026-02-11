# DataLens BI — Custom Business Intelligence Platform

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

## Phase Plan (12 phases)

### Phase 1 — Project Skeleton & DevOps ✅ (current)
- [x] Kotlin + Spring Boot project structure (Gradle)
- [x] Docker & Docker Compose setup
- [x] Multi-stage Dockerfile (build + runtime)
- [x] GitLab CI pipeline `.gitlab-ci.yml`
- [x] GitHub Actions workflow
- [x] README with setup instructions
- [x] Basic health-check endpoint

### Phase 2 — Data Source Connections
- [ ] DataSource entity & CRUD API
- [ ] PostgreSQL connector (HikariCP connection pool)
- [ ] ClickHouse connector (clickhouse-jdbc)
- [ ] Connection testing endpoint
- [ ] Dynamic query execution with parameterized queries
- [ ] SQL injection protection (prepared statements)
- [ ] Connection pool management & monitoring

### Phase 3 — Authentication & RBAC
- [ ] User entity (username, email, password hash)
- [ ] Role entity (ADMIN, EDITOR, VIEWER + custom roles)
- [ ] JWT authentication (access + refresh tokens)
- [ ] Login / Register / Refresh endpoints
- [ ] Permission model: datasource-level, report-level, row-level
- [ ] API endpoint security with `@PreAuthorize`
- [ ] Admin panel for user/role management

### Phase 4 — Query Builder & Metadata
- [ ] Schema introspection (tables, columns, types)
- [ ] Visual query builder API (select, join, filter, group, sort)
- [ ] Query to SQL compiler (dialect-aware: PG vs CH)
- [ ] Query result pagination & streaming
- [ ] Saved queries (with versioning)
- [ ] Query execution audit log

### Phase 5 — Report Engine (Core)
- [ ] Report entity model (JSON-based definition)
- [ ] Report ↔ DataSource ↔ Query associations
- [ ] Report parameter system (date ranges, filters, dropdowns)
- [ ] Report template CRUD API
- [ ] Server-side report rendering (data + layout)
- [ ] Report scheduling (cron-based)

### Phase 6 — Frontend: Dashboard & Report Viewer
- [ ] React app scaffolding (Vite + TypeScript)
- [ ] Authentication UI (login, session management)
- [ ] Dashboard grid layout (react-grid-layout)
- [ ] ECharts integration (bar, line, pie, table, KPI cards)
- [ ] Report parameter panel (date pickers, dropdowns)
- [ ] Auto-refresh & WebSocket live updates
- [ ] Responsive design (desktop + tablet)

### Phase 7 — JavaScript Scripting Engine
- [ ] GraalJS sandbox on backend (timeout, memory limits)
- [ ] Frontend JS sandbox (Function constructor, no eval)
- [ ] Script editor with Monaco Editor (IntelliSense)
- [ ] Chart event hooks: `onClick`, `onDataLoaded`, `onRender`
- [ ] Data transformation scripts (pre/post-processing)
- [ ] Conditional formatting via scripts
- [ ] Script library (reusable snippets)
- [ ] Script API: `chart.setOption()`, `report.setParameter()`, `data.filter()`

### Phase 8 — Drill-Down Reports
- [ ] Drill-down action model (click → navigate to child report)
- [ ] Parameter passing between reports
- [ ] Breadcrumb navigation
- [ ] Drill-through (row click → detail report)
- [ ] Drill-down in charts (ECharts tree/sunburst/treemap)
- [ ] Cross-report linking with context preservation
- [ ] Back-navigation with state restoration

### Phase 9 — Report Designer (Visual)
- [ ] Drag-and-drop report canvas
- [ ] Component palette (charts, tables, text, images, shapes)
- [ ] Property panel per component
- [ ] Data binding UI (drag field → axis/measure)
- [ ] Layout: free-form + grid + banded (header/detail/footer)
- [ ] Preview mode with live data
- [ ] Undo/redo system

### Phase 10 — Export & Distribution
- [ ] PDF export (server-side via Playwright or wkhtmltopdf)
- [ ] Excel export (Apache POI)
- [ ] CSV export
- [ ] Scheduled email delivery (SMTP)
- [ ] Report snapshots (point-in-time archives)
- [ ] Embedding API (iframe with token auth)

### Phase 11 — Advanced Features
- [ ] Calculated fields & measures (DAX-like expressions)
- [ ] Data alerts (threshold → notification)
- [ ] Dashboard filters (global cross-filtering)
- [ ] Bookmarks (saved filter states)
- [ ] Row-level security (RLS)
- [ ] Multi-tenancy support
- [ ] Localization (i18n)

### Phase 12 — Performance & Scale
- [ ] Query result caching (Redis)
- [ ] Materialized view management
- [ ] Query optimization advisor
- [ ] Connection pooling tuning
- [ ] Frontend lazy loading & virtualization
- [ ] Horizontal scaling (multiple backend instances)
- [ ] Monitoring (Prometheus + Grafana)

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
