# ══════════════════════════════════════════════
#  DataLens BI — Multi-Stage Docker Build
# ══════════════════════════════════════════════

# ── Stage 1: Build Backend ──
FROM gradle:8.10-jdk21 AS backend-build
WORKDIR /app
COPY settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
COPY backend/build.gradle.kts ./backend/
# Download dependencies first (cached layer)
RUN gradle :backend:dependencies --no-daemon || true
# Copy source and build
COPY backend/src ./backend/src
RUN gradle :backend:bootJar --no-daemon -x test

# ── Stage 2: Build Frontend ──
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 3: Runtime ──
FROM eclipse-temurin:21-jre-alpine
LABEL maintainer="your-email@example.com"
LABEL description="DataLens BI Platform"

# Install nginx for serving frontend + reverse proxy
RUN apk add --no-cache nginx \
    && mkdir -p /run/nginx

WORKDIR /app

# Copy backend JAR
COPY --from=backend-build /app/backend/build/libs/*.jar app.jar

# Copy frontend build
COPY --from=frontend-build /app/dist ./static

# Copy nginx config (overrides default)
COPY docker/nginx/frontend.conf /etc/nginx/http.d/default.conf

# Copy startup script
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

# Health check (hits nginx:8080 → proxies to java:8081)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

EXPOSE 8080

CMD ["/start.sh"]
