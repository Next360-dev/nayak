# AI Smart Office: web app + API in ONE image. Build:  docker build -t ai-smart-office .
# Stage 1 builds the web app, stage 2 is the Python server that also serves it.
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.14-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 APP_ENV=production HOST=0.0.0.0 PORT=8000
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=web /web/dist /app/frontend/dist
RUN useradd --create-home --uid 10001 app && chown -R app /app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"
# Tables are created/updated first (safe to repeat). ONE process only: the news robot lives inside it, so never add --workers.
# --forwarded-allow-ips='*' is safe here because port 8000 is only reachable from the proxy container (see docker-compose.prod.yml).
CMD ["sh", "-c", "python scripts/apply_migrations.py && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
