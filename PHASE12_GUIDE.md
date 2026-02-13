# Phase 12 — Performance & Scale

## Overview

Query result caching (Caffeine), connection pool monitoring, query optimization advisor,
custom Prometheus metrics, and system monitoring dashboard.

## Files to copy

### Backend — new files

| File from archive | Destination |
|---|---|
| `CacheConfig.kt` | `backend/src/main/kotlin/com/datalens/config/CacheConfig.kt` |
| `MetricsConfig.kt` | `backend/src/main/kotlin/com/datalens/config/MetricsConfig.kt` |
| `QueryCacheService.kt` | `backend/src/main/kotlin/com/datalens/service/QueryCacheService.kt` |
| `QueryOptimizationService.kt` | `backend/src/main/kotlin/com/datalens/service/QueryOptimizationService.kt` |
| `PerformanceDtos.kt` | `backend/src/main/kotlin/com/datalens/model/dto/PerformanceDtos.kt` |
| `PerformanceController.kt` | `backend/src/main/kotlin/com/datalens/controller/PerformanceController.kt` |

### Frontend — new files

| File from archive | Destination |
|---|---|
| `performance.ts` | `frontend/src/api/performance.ts` |
| `MonitoringPage.tsx` | `frontend/src/components/monitoring/MonitoringPage.tsx` |

> Create folder: `frontend/src/components/monitoring/`

## Patches (4 existing files)

### Patch 1 — `backend/build.gradle.kts`

Add Micrometer Prometheus dependency. Find `// ── Actuator ──` or add after actuator line:

```kotlin
    implementation("org.springframework.boot:spring-boot-starter-actuator")
```

Add after it:

```kotlin
    implementation("io.micrometer:micrometer-registry-prometheus")
```

### Patch 2 — `backend/src/main/resources/application.yml`

Find the `management:` section:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
```

Replace with:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: when-authorized
    prometheus:
      enabled: true
  metrics:
    export:
      prometheus:
        enabled: true
```

Also add cache config to the `datalens:` section:

```yaml
datalens:
  cache:
    enabled: true
    query-ttl-seconds: 300
    query-max-size: 500
    schema-ttl-seconds: 600
```

### Patch 3 — `frontend/src/App.tsx`

Add import:

```typescript
import MonitoringPage from '@/components/monitoring/MonitoringPage'
```

Add route inside `<Route element={<AppLayout />}>`:

```tsx
<Route path="/monitoring" element={<MonitoringPage />} />
```

### Patch 4 — `frontend/src/components/layout/Sidebar.tsx`

Add `Activity` to the lucide-react import.

Add to `navItems` array:

```typescript
{ to: '/monitoring', icon: Activity, label: 'Monitoring' },
```

## Cache Integration

To integrate caching into existing query execution, add to `SavedQueryService.kt`:

**1.** Add constructor parameter:

```kotlin
private val cacheService: QueryCacheService,
```

**2.** In `executeAdHocQuery` and `executeSavedQuery`, wrap the execution:

```kotlin
// Before executing
val cached = cacheService.get(datasourceId, sql, params)
if (cached != null) return cached

// After executing
cacheService.put(datasourceId, sql, params, result)
```

This is optional — the cache service is ready to use but doesn't auto-integrate
to avoid touching existing working code.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/performance/cache/stats` | Cache statistics |
| `POST` | `/api/performance/cache/invalidate` | Clear all cache |
| `POST` | `/api/performance/cache/invalidate/datasource/{id}` | Clear cache for datasource |
| `POST` | `/api/performance/cache/toggle?enabled=true` | Enable/disable cache |
| `GET` | `/api/performance/pools` | Connection pool stats |
| `GET` | `/api/performance/health` | System health overview |
| `POST` | `/api/performance/explain` | Run EXPLAIN on query |
| `POST` | `/api/performance/analyze` | Quick SQL analysis |
| `GET` | `/api/actuator/prometheus` | Prometheus metrics endpoint |

## Prometheus / Grafana (optional)

Add to `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

`prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'datalens'
    metrics_path: '/api/actuator/prometheus'
    scrape_interval: 15s
    static_configs:
      - targets: ['app:8080']
```

## Commit and deploy

```bash
git add backend/src/main/kotlin/com/datalens/config/CacheConfig.kt \
       backend/src/main/kotlin/com/datalens/config/MetricsConfig.kt \
       backend/src/main/kotlin/com/datalens/service/QueryCacheService.kt \
       backend/src/main/kotlin/com/datalens/service/QueryOptimizationService.kt \
       backend/src/main/kotlin/com/datalens/model/dto/PerformanceDtos.kt \
       backend/src/main/kotlin/com/datalens/controller/PerformanceController.kt \
       backend/build.gradle.kts \
       backend/src/main/resources/application.yml \
       frontend/src/api/performance.ts \
       frontend/src/components/monitoring/MonitoringPage.tsx \
       frontend/src/App.tsx \
       frontend/src/components/layout/Sidebar.tsx

git commit -m "feat: Phase 12 — Performance & Scale (query cache, monitoring, EXPLAIN advisor, Prometheus metrics)"
git push origin main
```
