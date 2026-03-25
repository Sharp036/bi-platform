# Datorio

Open-source Business Intelligence platform with support for PostgreSQL and ClickHouse, 
built-in JavaScript scripting for chart customization, drill-down reports, 
and role-based access control.

## Features

- **Multi-Database Support** — Connect to PostgreSQL and ClickHouse data sources
- **JavaScript Scripting** — Customize chart behavior with built-in JS engine (GraalJS)
- **Drill-Down Reports** — Navigate from summary to detail with parameter passing
- **Role-Based Access** — ADMIN / EDITOR / VIEWER roles with object-level permissions
- **Visual Report Designer** — Drag-and-drop interface with Apache ECharts
- **Docker Deployment** — Single `docker-compose up` to run everything
- **REST API** — Full API with Swagger/OpenAPI documentation

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Kotlin + Spring Boot 3 |
| Frontend | React + TypeScript |
| Charts | Apache ECharts 5 |
| Scripting | GraalJS (server) + JS Sandbox (client) |
| Auth | Spring Security + JWT |
| Build | Gradle (Kotlin DSL) |
| Database | PostgreSQL (metadata) + any PG/CH (data) |
| CI/CD | GitLab CI + GitHub Actions |

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) — production setup, nginx configuration, API keys, environment variables

## Quick Start

### Prerequisites
- Docker & Docker Compose
- (Optional) JDK 21, Node.js 20+ for local development

### Run with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/datorio.git
cd datorio

# Copy environment config
cp .env.example .env

# Start all services
docker-compose up -d

# Check health
curl http://localhost:8080/api/health
```

### Default Credentials
- **Username:** `admin`  
- **Password:** `admin`  
- **API Docs:** http://localhost:8080/api/docs/swagger

### Local Development

```bash
# Start dependencies
docker-compose up -d postgres clickhouse

# Run backend
cd backend
../gradlew bootRun

# Run frontend (after Phase 6)
cd frontend
npm install && npm run dev
```

## API Overview

### Authentication
```bash
# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Use the returned access token
export TOKEN="<access_token>"
```

### Data Sources
```bash
# Add a PostgreSQL data source
curl -X POST http://localhost:8080/api/datasources \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production DB",
    "type": "POSTGRESQL",
    "host": "your-pg-host",
    "port": 5432,
    "databaseName": "mydb",
    "username": "reader",
    "password": "secret"
  }'

# Test connection
curl -X POST http://localhost:8080/api/datasources/1/test \
  -H "Authorization: Bearer $TOKEN"

# Browse schema
curl http://localhost:8080/api/datasources/1/schema \
  -H "Authorization: Bearer $TOKEN"

# Execute query
curl -X POST http://localhost:8080/api/query/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "datasourceId": 1,
    "sql": "SELECT * FROM sales LIMIT 100"
  }'
```

## Project Structure

```
datorio/
├── backend/
│   └── src/main/kotlin/com/datorio/
│       ├── config/          # Security, exception handling
│       ├── controller/      # REST endpoints
│       ├── datasource/      # Dynamic DB connection manager
│       ├── model/           # JPA entities & DTOs
│       ├── repository/      # Spring Data repositories
│       ├── security/        # JWT auth filter & provider
│       └── service/         # Business logic
├── frontend/                # React app (Phase 6+)
├── docker/                  # Docker init scripts
├── Dockerfile               # Multi-stage build
├── docker-compose.yml       # Full stack orchestration
├── .gitlab-ci.yml           # GitLab CI pipeline
├── .github/workflows/       # GitHub Actions
└── PROJECT_ROADMAP.md       # Detailed development plan
```

## Development Roadmap

See [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) for the full 12-phase plan.

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Project skeleton, Docker, CI/CD |
| 2 | ✅ | Data source connections (PG + CH) |
| 3 | ✅ | Authentication & RBAC |
| 4 | 🔲 | Query builder & metadata |
| 5 | 🔲 | Report engine (core) |
| 6 | 🔲 | Frontend: Dashboard & viewer |
| 7 | 🔲 | JavaScript scripting engine |
| 8 | 🔲 | Drill-down reports |
| 9 | 🔲 | Visual report designer |
| 10 | 🔲 | Export & distribution |
| 11 | 🔲 | Advanced features |
| 12 | 🔲 | Performance & scale |

## License

MIT License — see [LICENSE](LICENSE) for details.
