# syntax=docker/dockerfile:1.7
# One image runs the whole product: FastAPI serves the API and the built React app.
# The same image runs locally (docker compose), in CI, and on any container host.

# ---- 1. Build the React app ---------------------------------------------------
FROM node:25-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. Python runtime ----------------------------------------------------------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend/src \
    GRIDBRICKS_ENVIRONMENT=production \
    GRIDBRICKS_LOG_JSON=true \
    GRIDBRICKS_DATA_DIR=/app/backend/data/snapshot \
    GRIDBRICKS_STATIC_DIR=/app/static \
    PORT=8000 \
    WEB_CONCURRENCY=2
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /usr/local/bin/uv
COPY requirements.txt ./
RUN uv pip install --system --no-cache -r requirements.txt

COPY backend/src backend/src
COPY backend/data backend/data
COPY --from=web /web/dist static

RUN useradd --create-home --uid 10001 app
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ.get('PORT', '8000')}/api/health\", timeout=4)"

# $PORT is honoured so the image also runs unchanged on Heroku or AWS App Runner.
CMD ["sh", "-c", "exec uvicorn gridbricks.main:create_app --factory --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY} --proxy-headers --forwarded-allow-ips='*' --no-access-log"]
