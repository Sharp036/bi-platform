# Phase 6 — Frontend: Dashboard & Report Viewer

## Architecture

Frontend встроен в **тот же Docker-образ**, что и backend.
Внутри контейнера:
- **nginx** (порт 8080) — отдаёт SPA, проксирует `/api` на Java
- **Java** (порт 8081) — Spring Boot backend

Снаружи ничего не меняется: один контейнер, один порт 8080.
CI/CD, docker-compose.prod.yml на сервере, Harbor — всё работает как раньше.

```
Browser → :8080 (nginx)
              ├── /            → static/index.html (SPA)
              ├── /login       → static/index.html (SPA)
              ├── /reports     → static/index.html (SPA)
              └── /api/*       → proxy → 127.0.0.1:8081 (Java)
```

## Что нового в архиве

```
bi-platform/
├── Dockerfile                          ← ЗАМЕНИТЬ (раскомментирован frontend)
├── docker/
│   ├── clickhouse/init.sql             ← уже есть, не трогать
│   ├── nginx/frontend.conf             ← НОВЫЙ (nginx конфиг)
│   └── start.sh                        ← НОВЫЙ (запуск nginx + java)
├── frontend/                           ← НОВАЯ ПАПКА (весь React)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── .env.example
│   ├── public/vite.svg
│   └── src/
│       ├── main.tsx, App.tsx, index.css
│       ├── types/index.ts
│       ├── api/          (client, auth, datasources, queries, reports)
│       ├── store/        (authStore, themeStore)
│       ├── hooks/        (useAutoRefresh)
│       └── components/
│           ├── common/       LoadingSpinner, EmptyState
│           ├── layout/       AppLayout, Sidebar, Header
│           ├── auth/         LoginPage, ProtectedRoute
│           ├── dashboard/    DashboardPage, ScheduleListPage
│           ├── reports/      ReportList, ReportViewer, ParameterPanel, WidgetRenderer
│           ├── charts/       EChartWidget, TableWidget, KpiCard
│           ├── datasources/  DataSourceListPage
│           └── queries/      QueryListPage
└── docker-compose.yml                  ← НЕ МЕНЯЕТСЯ
```

## Шаг 1 — Скопировать файлы в репозиторий

1. **`frontend/`** — вся папка из архива → в корень `bi-platform/frontend/`
2. **`docker/nginx/frontend.conf`** — из архива → в `bi-platform/docker/nginx/frontend.conf`
3. **`docker/start.sh`** — из архива → в `bi-platform/docker/start.sh`
4. **`Dockerfile`** — из архива → **заменить** `bi-platform/Dockerfile`

## Шаг 2 — Коммит и деплой

```bash
git add frontend/ docker/nginx/ docker/start.sh Dockerfile
git commit -m "feat: Phase 6 — frontend (React + nginx in single image)"
git push origin main
```

CI автоматически:
1. Соберёт новый образ (backend + frontend + nginx)
2. Запушит в Harbor
3. Подтянет на сервер
4. Перезапустит контейнер

## Шаг 3 — Проверка

- **UI**: `http://<ваш-сервер>:8090` (тот же порт что и раньше!)
- **API**: `http://<ваш-сервер>:8090/api`
- **Swagger**: `http://<ваш-сервер>:8090/api/docs/swagger-ui/index.html`
- **Логин**: admin / admin

## Что НЕ меняется

| Файл | Статус |
|------|--------|
| `.gitlab-ci.yml` | Без изменений |
| `docker-compose.yml` | Без изменений |
| `docker-compose.prod.yml` (на сервере) | Без изменений |
| `.env` / `.env.example` | Без изменений |
| `backend/` | Без изменений |
| Порты (8090 на сервере) | Без изменений |

## Локальная разработка (без Docker)

```bash
# 1. Запустить backend (порт 8080)
cd backend && ../gradlew bootRun

# 2. В другом терминале — запустить frontend (порт 3000)
cd frontend && npm install && npm run dev
```

Vite проксирует `/api` на `localhost:8080`. Открыть `http://localhost:3000`.

## Локальная разработка (с Docker)

```bash
docker-compose up -d --build
```

Откроется на `http://localhost:8080` — nginx внутри контейнера
отдаёт SPA и проксирует API.

## Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | LoginPage | JWT login form |
| `/` | DashboardPage | Overview stats, recent reports |
| `/reports` | ReportListPage | Browse/search reports |
| `/reports/:id` | ReportViewerPage | Render with parameters + charts |
| `/queries` | QueryListPage | Ad-hoc SQL + saved queries |
| `/datasources` | DataSourceListPage | CRUD + test connections |
| `/schedules` | ScheduleListPage | Manage report schedules |

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.3 | UI framework |
| TypeScript | 5.6 | Type safety |
| Vite | 6.0 | Build tool, HMR |
| Tailwind CSS | 3.4 | Styling |
| Zustand | 5.0 | State management |
| Axios | 1.7 | HTTP client + JWT interceptors |
| React Router | 6.28 | Routing |
| Apache ECharts | 5.5 | Charts (bar, line, pie) |
| Lucide React | 0.460 | Icons |
| react-hot-toast | 2.4 | Notifications |
