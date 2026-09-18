# syntax=docker/dockerfile:1.7
#
# KCMS in one container.
#
# Everything the project-management system needs runs inside this image under a
# supervisor: PostgreSQL, Valkey, MinIO, the API, the Celery worker and beat, the
# space and live servers, and Caddy serving the web and admin bundles on one port.
# There is no RabbitMQ: Celery takes its broker from AMQP_URL, and that is pointed
# at Valkey.
#
# Build context is the repository root (modules/kiran-mgmt):
#
#   docker build -f deployments/kcms/Dockerfile -t kcms:local .
#
# State lives under /data, so one volume there is the whole backup.

# *****************************************************************************
# STAGE 1: build the four JavaScript apps from this repository's source
# *****************************************************************************
FROM node:22-alpine AS frontend

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
ENV CI=true
ENV TURBO_TELEMETRY_DISABLED=1
# pnpm 9, not the pnpm 11 that package.json names: the committed lockfile was written
# without the `overrides` block in pnpm-workspace.yaml, which pnpm 9 does not read and
# pnpm 11 refuses to install against. This is the version the lockfile is good for.
RUN apk add --no-cache libc6-compat && npm install -g pnpm@9.15.4

WORKDIR /app

# Download dependencies from the lockfile alone, so editing source does not
# download them again.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir=/pnpm/store

COPY . .

# packages/i18n/locales is a symlink to src/locales in git, and the built package
# imports "../locales/<lang>/<namespace>.json" through it. A Windows checkout turns
# the link into a text file, and every label in the UI then falls back to its key.
RUN rm -rf packages/i18n/locales && ln -s src/locales packages/i18n/locales

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --store-dir=/pnpm/store

# One origin: the browser reaches the API, admin, spaces and live through the
# same host as the web app, so every base URL is empty and only the paths differ.
ENV VITE_API_BASE_URL=""
ENV VITE_WEB_BASE_URL=""
ENV VITE_ADMIN_BASE_URL=""
ENV VITE_ADMIN_BASE_PATH="/god-mode"
ENV VITE_SPACE_BASE_URL=""
ENV VITE_SPACE_BASE_PATH="/spaces"
ENV VITE_LIVE_BASE_URL=""
ENV VITE_LIVE_BASE_PATH="/live"

# The web bundle is large. One build at a time, with a raised heap, fits in the
# 4 GB Docker Desktop gives a build by default.
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN pnpm turbo run build --concurrency=1 \
      --filter=web --filter=admin --filter=space --filter=live

# esbuild and tsgolint are build-only Go binaries.
RUN find /app/node_modules \( -name 'esbuild' -o -name 'tsgolint' \) -type f -delete 2>/dev/null || true

# *****************************************************************************
# STAGE 2: the MinIO server binary
# *****************************************************************************
FROM minio/minio:latest AS minio

# *****************************************************************************
# STAGE 3: runtime
# *****************************************************************************
FROM python:3.12.10-alpine AS runner

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apk update && apk upgrade && apk add --no-cache \
      bash curl su-exec tzdata ca-certificates openssl \
      libpq libxslt xmlsec libffi-dev \
      postgresql16 postgresql16-contrib valkey caddy nodejs

# ---- API -------------------------------------------------------------------
WORKDIR /app/backend
COPY apps/api/requirements.txt ./
COPY apps/api/requirements ./requirements
RUN apk add --no-cache --virtual .build-deps \
      g++ gcc cargo git make postgresql16-dev libc-dev linux-headers \
    && pip install -r requirements.txt --compile --no-cache-dir \
    && pip install --no-cache-dir supervisor \
    && apk del .build-deps

COPY apps/api/manage.py manage.py
COPY apps/api/plane plane/
COPY apps/api/templates templates/
COPY apps/api/package.json package.json
COPY apps/api/bin ./bin/
RUN mkdir -p /app/backend/plane/logs && chmod +x ./bin/*

# ---- The four apps -----------------------------------------------------------
COPY --from=frontend /app/apps/web/build/client /app/web
COPY --from=frontend /app/apps/admin/build/client /app/admin

COPY --from=frontend /app/node_modules /app/js/node_modules
COPY --from=frontend /app/packages /app/js/packages
COPY --from=frontend /app/apps/space/build /app/js/apps/space/build
COPY --from=frontend /app/apps/space/node_modules /app/js/apps/space/node_modules
COPY --from=frontend /app/apps/space/package.json /app/js/apps/space/package.json
COPY --from=frontend /app/apps/live/dist /app/js/apps/live/dist
COPY --from=frontend /app/apps/live/node_modules /app/js/apps/live/node_modules
COPY --from=frontend /app/apps/live/package.json /app/js/apps/live/package.json

# ---- MinIO -------------------------------------------------------------------
COPY --from=minio /usr/bin/minio /usr/local/bin/minio

# ---- Process supervision -------------------------------------------------------
COPY deployments/kcms/Caddyfile /app/proxy/Caddyfile
COPY deployments/kcms/supervisor.conf /etc/supervisor/conf.d/kcms.conf
COPY deployments/kcms/start.sh /app/start.sh
COPY deployments/kcms/seed-demo.sh /usr/local/bin/kcms-seed-demo
RUN sed -i 's/\r$//' /app/start.sh /usr/local/bin/kcms-seed-demo /app/backend/bin/*.sh \
    && chmod +x /app/start.sh /usr/local/bin/kcms-seed-demo \
    && mkdir -p /data /app/logs /run/postgresql \
    && chown postgres:postgres /run/postgresql

VOLUME ["/data"]
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=5 \
  CMD curl -fsS http://127.0.0.1/api/instances/ >/dev/null || exit 1

CMD ["/app/start.sh"]
