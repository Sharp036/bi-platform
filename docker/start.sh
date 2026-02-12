#!/bin/sh
# ══════════════════════════════════════════════
#  DataLens BI — Container Startup
#  Runs nginx (frontend) + Java (backend)
# ══════════════════════════════════════════════

# Start nginx in background (serves frontend, proxies /api)
nginx -g 'daemon on;'

# Start Java in foreground (backend on port 8081)
exec java \
  -Dserver.port=8081 \
  -XX:+UseContainerSupport \
  -XX:MaxRAMPercentage=75.0 \
  -Djava.security.egd=file:/dev/./urandom \
  -jar app.jar
