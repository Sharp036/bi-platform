# Datorio

**Self-hosted, open-source BI for PostgreSQL and ClickHouse.** Build reports and dashboards in a visual designer, start Apache Airflow DAGs from a button on a report, and load Excel, CSV, JSON and ZIP files into your database. Everything runs in one Docker container.

[![CI](https://github.com/Sharp036/bi-platform/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Sharp036/bi-platform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker image](https://img.shields.io/badge/docker-ghcr.io%2Fsharp036%2Fbi--platform-2496ED?logo=docker&logoColor=white)](https://github.com/Sharp036/bi-platform/pkgs/container/bi-platform)

## Highlights

### Run Airflow DAGs from a report

Put a **Start a job** button on a report, and business users can start an Apache Airflow DAG without opening Airflow:

- the applied report parameters become the configuration of the DAG run; numbers, lists and booleans keep their types;
- the name of the user who pressed the button, and their email, can be passed to the DAG as well;
- a progress bar under the button shows the current task, the completed steps and the elapsed time, names the task that failed, and the report refreshes when the run is over;
- the button can stay unavailable until the required parameters are applied or until a given table shows rows, with the reason shown under it;
- only DAGs from an allow-list can be started; Datorio talks to the Airflow 3 REST API with a service account.

### Load data from files

An import source describes how a file lands in a PostgreSQL or ClickHouse table:

- formats: Excel (.xlsx), CSV, TSV, JSON (with a path to the array of records), and ZIP archives with several files selected by a file name pattern;
- sheet, header row, rows to skip and file encoding;
- column mapping with data types, date formats, constant values and nullability, plus a strict column set and forbidden columns;
- load modes: append, replace, or upsert by key columns;
- preview before loading, and an import history with row-level errors;
- upload from the UI, or from scripts and other systems with an API key.

## Features

**Reports and dashboards**
- Drag-and-drop report designer on Apache ECharts: bar, line, area, pie, scatter, funnel, gauge, heatmap, radar, sankey, treemap, boxplot, candlestick, waterfall, KPI cards and tables
- Parameter panel with required fields and collapsible groups, global filters, cross-filtering, drill-down between reports with parameter passing
- Interactive dashboards: chart layers, dynamic zones, overlays, containers, annotations, rich tooltips, buttons that navigate, show or hide widgets, filter, export, open a URL or run a job
- Data modeling layer: a semantic model with automatic joins and an Explore view
- Calculated fields, bookmarks, templates exported and imported as JSON
- Live updates over Server-Sent Events
- Server-side JavaScript (sandboxed GraalJS) to transform chart data

**Sharing and operations**
- Export to CSV, Excel and PDF, send a report by email, embed reports with tokens
- Scheduled report snapshots (cron) and data alerts with a history of triggered and resolved events
- Query caching, performance monitoring and a query advisor
- Roles (ADMIN, EDITOR, VIEWER), object-level permissions and sharing, folders, favorites, tags and global search
- UI in 28 languages, light and dark themes
- REST API with OpenAPI documentation (Swagger UI)

## Quick start

Requirements: Docker with Docker Compose.

```bash
git clone https://github.com/Sharp036/bi-platform.git
cd bi-platform
cp .env.example .env      # set ADMIN_PASSWORD and JWT_SECRET
docker compose up -d
```

Open http://localhost:8080 and sign in with `ADMIN_USER` / `ADMIN_PASSWORD` from `.env` (`admin` / `admin` by default).

The stack also starts PostgreSQL for the application metadata and a ClickHouse server with sample tables (`sample.sales`, `sample.page_views`). To try the designer on them, add a ClickHouse data source with host `clickhouse`, port `8123`, user `default` and the password from `CH_PASSWORD`.

The API documentation is at http://localhost:8080/api/docs/swagger.

A ready image of the `main` branch is published as `ghcr.io/sharp036/bi-platform:latest`.

## Connect Apache Airflow

Set the Airflow connection in `.env` and run `docker compose up -d` again to recreate the container:

```bash
AIRFLOW_API_URL=http://airflow-apiserver:8080   # Airflow 3 API server
AIRFLOW_API_USER=datorio_service
AIRFLOW_API_PASSWORD=change_me
AIRFLOW_ALLOWED_DAGS=example_dag_id,another_dag_id
```

Then add a **Button** widget to a report, choose the **Start a job** type and fill in its fields (the widget config key is in brackets):

| Designer field | Meaning |
|----------------|---------|
| Job (Airflow DAG id) (`jobId`) | the DAG to start; it must be listed in `AIRFLOW_ALLOWED_DAGS` |
| Report parameters to send (`jobParams`) | the parameters passed to the DAG; all of them when none is chosen |
| Job parameter for the user name (`jobUserParam`) | receives the name of the user who pressed the button |
| Job parameter for the user email (`jobEmailParam`) | receives the user's email when the report leaves it empty |
| Required parameters (`requiredParams`) | the button is unavailable until these parameters are applied |
| Widget title (`requireRowsIn`) | the button is unavailable while that widget has no rows |
| Confirmation question (`confirmText`) | asked before the start |

For a report with the parameters `date_from` and `region` (a multi-select) and `jobUserParam` set to `requested_by`, the DAG run receives a configuration like:

```json
{"date_from": "2026-10-01", "region": ["North", "South"], "requested_by": "alice"}
```

See the [deployment guide](docs/DEPLOYMENT.md) for the Airflow role the service account needs.

## Upload files from scripts

Generate an API key in **Data Import** > **API Keys**, then send a file to an import source:

```bash
curl -X POST http://localhost:8080/api/import/sources/{source_id}/upload \
  -H "Authorization: Bearer dat_YOUR_API_KEY" \
  -F "file=@data.xlsx"
```

The response reports the rows imported and failed; `GET /api/import/logs/{id}/errors` returns the row-level errors.

## Documentation

- [Deployment guide](docs/DEPLOYMENT.md): production setup, reverse proxy, Airflow, the import API, the scripting sandbox and environment variables
- [Development roadmap](docs/development/PROJECT_ROADMAP.md): how the platform was built, phase by phase

## Tech stack

| Component | Technology |
|-----------|------------|
| Backend | Kotlin, Spring Boot 3 |
| Frontend | React, TypeScript |
| Charts | Apache ECharts 5 |
| Scripting | GraalJS (server), sandbox (client) |
| Auth | Spring Security, JWT, API keys |
| Metadata | PostgreSQL |
| Data sources | PostgreSQL, ClickHouse |
| Build | Gradle (Kotlin DSL), Vite |

## Local development

```bash
docker compose up -d postgres clickhouse

# backend
./gradlew :backend:bootRun

# frontend
cd frontend
npm install
npm run dev
```

## Contributing

Bug reports, ideas and pull requests are welcome: open an [issue](https://github.com/Sharp036/bi-platform/issues) or a pull request.

## License

MIT, see [LICENSE](LICENSE).
