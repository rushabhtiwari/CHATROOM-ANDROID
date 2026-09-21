#!/bin/bash
# Boots KCMS inside its single container: prepares /data on first run, fixes the
# environment every process shares, then hands over to the supervisor.
set -euo pipefail

DATA=/data
PGDATA="$DATA/postgres"
SECRETS="$DATA/kcms.env"

mkdir -p "$DATA/minio" "$DATA/valkey" /app/logs /run/postgresql
chown postgres:postgres /run/postgresql
touch "$SECRETS"
chmod 600 "$SECRETS"

# A value passed to `docker run` wins. Otherwise the value generated on first boot
# is reused, so sessions and stored files survive the container being recreated.
persist() {
    local key="$1" length="$2"
    if [ -z "${!key:-}" ]; then
        if ! grep -q "^${key}=" "$SECRETS"; then
            echo "${key}=$(openssl rand -hex "$((length / 2))")" >>"$SECRETS"
        fi
        export "${key}=$(grep "^${key}=" "$SECRETS" | cut -d= -f2-)"
    fi
}
persist SECRET_KEY 50
persist LIVE_SERVER_SECRET_KEY 50
persist AWS_ACCESS_KEY_ID 20
persist AWS_SECRET_ACCESS_KEY 40

# ---- PostgreSQL ---------------------------------------------------------------
# The database listens on the container's loopback only and is never published,
# so local connections are trusted rather than carrying a password around.
if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "kcms: creating the database"
    install -d -o postgres -g postgres -m 700 "$PGDATA"
    su-exec postgres initdb -D "$PGDATA" -U kcms --encoding=UTF8 --locale=C \
        --auth-local=trust --auth-host=trust >/dev/null
    {
        echo "listen_addresses = '127.0.0.1'"
        echo "max_connections = 100"
        echo "shared_buffers = 128MB"
    } >>"$PGDATA/postgresql.conf"
    su-exec postgres pg_ctl -D "$PGDATA" -w -o "-c listen_addresses=''" start >/dev/null
    su-exec postgres createdb -U kcms kcms
    su-exec postgres pg_ctl -D "$PGDATA" -w -m fast stop >/dev/null
fi
chown -R postgres:postgres "$PGDATA"
rm -f "$PGDATA/postmaster.pid"

# ---- Shared environment ---------------------------------------------------------
export WEB_URL="${WEB_URL:-http://localhost:3020}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-$WEB_URL}"
export DEBUG=0
export DATABASE_URL="postgresql://kcms@127.0.0.1:5432/kcms"
export REDIS_URL="redis://127.0.0.1:6379/0"
# Celery reads its broker from AMQP_URL. Valkey does that job here, so the stack
# carries no RabbitMQ.
export AMQP_URL="redis://127.0.0.1:6379/1"

export USE_MINIO=1
export MINIO_ROOT_USER="$AWS_ACCESS_KEY_ID"
export MINIO_ROOT_PASSWORD="$AWS_SECRET_ACCESS_KEY"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_S3_ENDPOINT_URL="http://127.0.0.1:9000"
export AWS_S3_BUCKET_NAME="${AWS_S3_BUCKET_NAME:-uploads}"
export BUCKET_NAME="$AWS_S3_BUCKET_NAME"
export FILE_SIZE_LIMIT="${FILE_SIZE_LIMIT:-10485760}"
export MINIO_ENDPOINT_SSL="${MINIO_ENDPOINT_SSL:-0}"

export GUNICORN_WORKERS="${GUNICORN_WORKERS:-2}"
export API_KEY_RATE_LIMIT="${API_KEY_RATE_LIMIT:-60/minute}"
export API_BASE_URL="http://127.0.0.1:3004"
export LIVE_BASE_PATH="/live"
export SITE_ADDRESS="${SITE_ADDRESS:-:80}"

# ---- Central Platform single sign-on ------------------------------------------------
# The browser reaches the identity service on the host's localhost; this container
# reaches the same service through the Docker host gateway.
export CENTRAL_ISSUER_URL="${CENTRAL_ISSUER_URL:-http://localhost:8000}"
export CENTRAL_INTERNAL_URL="${CENTRAL_INTERNAL_URL:-http://host.docker.internal:8000}"
export CENTRAL_PORTAL_URL="${CENTRAL_PORTAL_URL:-http://localhost:3000}"
export CENTRAL_CLIENT_ID="${CENTRAL_CLIENT_ID:-projects}"
export CENTRAL_WORKSPACE="${CENTRAL_WORKSPACE:-kiran}"
export ENABLE_SIGNUP="${ENABLE_SIGNUP:-0}"

# `docker exec` does not inherit any of the above, so commands run inside the
# container later (the demo seeder) read it back from here.
export -p >/run/kcms-env.sh
chmod 600 /run/kcms-env.sh

echo "kcms: starting on $WEB_URL"
exec /usr/local/bin/supervisord -c /etc/supervisor/conf.d/kcms.conf
