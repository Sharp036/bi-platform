# Datorio — Deployment Guide

## Requirements

- Docker 24+
- Docker Compose v2
- A reverse proxy (nginx) with SSL termination
- PostgreSQL is embedded (runs in a separate container)
- ClickHouse or PostgreSQL for analytical data sources (external, not included)

---

## Production Deployment

### 1. Prepare the server

Create the application directory and production compose file:

```bash
mkdir -p /opt/bi-platform
cd /opt/bi-platform
```

Create `/opt/bi-platform/docker-compose.prod.yml`:

```yaml
services:
  datorio:
    image: harbor-dev.rbtdigitalmobile.ru/data/bi-platform/main:latest
    container_name: datorio
    restart: unless-stopped
    ports:
      - "8090:8080"
    environment:
      SPRING_PROFILES_ACTIVE: docker
      DB_HOST: datorio-postgres
      DB_PORT: 5432
      DB_NAME: datorio
      DB_USER: datorio
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_USER: ${ADMIN_USER}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
    depends_on:
      datorio-postgres:
        condition: service_healthy

  datorio-postgres:
    image: postgres:16-alpine
    container_name: datorio-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: datorio
      POSTGRES_USER: datorio
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - datorio_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U datorio"]
      interval: 5s
      retries: 5

volumes:
  datorio_pg_data:
```

Create `/opt/bi-platform/.env`:

```env
DB_PASSWORD=your_secure_db_password
JWT_SECRET=your_random_secret_at_least_32_chars
ADMIN_USER=admin
ADMIN_PASSWORD=your_admin_password
ADMIN_EMAIL=admin@example.com
```

### 2. Start the application

```bash
cd /opt/bi-platform
docker-compose -f docker-compose.prod.yml up -d
```

The application will be available on port `8090`.
Flyway runs database migrations automatically on startup.

---

## Nginx Configuration

Datorio must be proxied through nginx (or another reverse proxy) with SSL.
The nginx container used in production is `superset_nginx`.

Config file location inside the container: `/etc/nginx/nginx.conf`

### nginx server block for Datorio

```nginx
server {
    listen 443 ssl;
    server_name datorio.example.com;

    ssl_certificate /etc/nginx/certs/fullchain.crt;
    ssl_certificate_key /etc/nginx/certs/private.key;

    # Required for file upload (ZIP/JSON imports can be large)
    client_max_body_size 200m;

    location / {
        proxy_pass http://<server_ip>:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_request_buffering off;
    }
}
```

Key settings:
- `client_max_body_size 200m` — allows uploads up to 200 MB (ZIP archives with import data)
- `proxy_read_timeout 600s` — allows up to 10 minutes for large import jobs (~200k rows)
- `proxy_request_buffering off` — streams the upload directly to the backend instead of buffering

After editing the config, reload nginx without downtime:

```bash
docker exec superset_nginx nginx -t && docker exec superset_nginx nginx -s reload
```

### Spring Boot upload limit

In addition to nginx, Spring Boot has its own multipart limit.
It is configured in `backend/src/main/resources/application.yml`:

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 200MB
      max-request-size: 200MB
```

Both the nginx limit and the Spring Boot limit must be large enough for the files you expect.

---

## CI/CD

GitLab CI builds the Docker image on every push to `main` and deploys it to the server.

Pipeline stages:
1. `build` — builds the image and pushes to Harbor registry
2. `deploy` — SSH to the server, pulls the new image, restarts the container via `docker-compose.prod.yml`

The pipeline is defined in `.gitlab-ci.yml`.

---

## Data Import API

The import module supports programmatic file upload via API keys.
This allows external applications to push data without a user login.

### Step 1: Generate an API key

In Datorio UI: **Data Import** -> **API Keys** tab -> **Generate**.

The key is shown once. It has the format `dat_<43 characters>`.

### Step 2: Upload a file

```bash
curl -X POST https://datorio.example.com/api/import/sources/{source_id}/upload \
  -H "Authorization: Bearer dat_YOUR_API_KEY" \
  -F "file=@/path/to/data.zip"
```

The `source_id` is the numeric ID of the import source (visible in the URL when editing the source, or use the list endpoint below).

### Available import endpoints

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/import/sources` | List all configured import sources |
| `POST` | `/api/import/sources/{id}/upload` | Upload a file for import |
| `POST` | `/api/import/sources/{id}/preview` | Preview first rows without importing |
| `GET` | `/api/import/logs` | Import history |
| `GET` | `/api/import/logs/{id}/errors` | Row-level errors for a log entry |

All endpoints require `Authorization: Bearer <token>` — either a JWT from the login endpoint or an API key.

### Python example

```python
import requests

API_BASE = "https://datorio.example.com/api"
API_KEY = "dat_YOUR_API_KEY"
SOURCE_ID = 3

with open("/path/to/prices.zip", "rb") as f:
    response = requests.post(
        f"{API_BASE}/import/sources/{SOURCE_ID}/upload",
        headers={"Authorization": f"Bearer {API_KEY}"},
        files={"file": f},
    )

result = response.json()
print(f"Imported: {result['rowsImported']} / {result['rowsTotal']}")
if result["status"] == "error":
    for err in result["errors"]:
        print(f"  Row {err['rowNumber']}: {err['errorMessage']}")
```

### Response format

```json
{
  "logId": 42,
  "rowsTotal": 214820,
  "rowsImported": 214820,
  "rowsFailed": 0,
  "status": "success",
  "errors": []
}
```

`status` values: `success`, `error`.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `datorio` |
| `DB_USER` | Database user | `datorio` |
| `DB_PASSWORD` | Database password | required |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | required |
| `ADMIN_USER` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | required |
| `ADMIN_EMAIL` | Initial admin email | required |
