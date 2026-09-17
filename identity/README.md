# Identity Service

Central sign-in for company apps. It is an OpenID Connect provider that federates Google
Workspace, decides each user's role per app (department grants plus per-person exceptions),
and serves the user and admin APIs the portal uses.

Design: `docs/superpowers/specs/2026-09-16-central-platform-sso-design.md`.

## Local development

Requires Docker, Python 3.12 and [uv](https://docs.astral.sh/uv/).

```bash
# Everything in containers (identity on http://localhost:8000, dev login enabled)
docker compose up --build

# Or run the service from source against the Compose Postgres
docker compose up -d postgres
cd identity
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:create_app --factory --reload
```

With `DEV_LOGIN_ENABLED=true`, `/login` goes to `/dev-login`, a picker of seeded users, so no
Google credentials are needed. The service refuses to start with dev login enabled when
`ENVIRONMENT=production`.

Seeded users: `admin@yourco.com` (admin, Sales), `sam@yourco.com` (Sales),
`fiona@yourco.com` (Finance), `newbie@yourco.com` (no department). The seeded client `example`
uses secret `dev-client-secret`.

## Tests

```bash
docker compose up -d postgres
cd identity
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

Tests use the `identity_test` database (`TEST_DATABASE_URL` overrides it). The schema is rebuilt
from the Alembic migrations at the start of each run, and every test is rolled back.

## Configuration

| Variable | Purpose |
|---|---|
| `ENVIRONMENT` | `development`, `test`, `staging` or `production` |
| `COMPANY_DOMAIN` | Google Workspace domain allowed to sign in |
| `ISSUER_URL` | Public URL of this service, e.g. `https://auth.yourco.com` (https required outside development) |
| `DATABASE_URL` | `postgresql+psycopg://…` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client (see below) |
| `KEY_ENCRYPTION_KEY` | Fernet key that encrypts private signing keys at rest |
| `SESSION_SECRET` | Signs the short-lived sign-in flow cookie |
| `INITIAL_ADMIN_EMAILS` | Comma-separated emails made admin on first sign-in |
| `PORTAL_URL`, `PORTAL_CLIENT_SECRET` | Portal client registration, synced at startup |
| `DEV_LOGIN_ENABLED` | Development-only user picker |
| `FORWARDED_ALLOW_IPS` | (container) proxy addresses trusted for `X-Forwarded-*` |

Generate a key-encryption key with
`uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.

## Google OAuth client

In Google Cloud Console, for the Workspace organisation:

1. Set the OAuth consent screen user type to **Internal**.
2. Create an OAuth client ID of type **Web application**.
3. Add the authorized redirect URI `https://auth.<your-domain>/google/callback`.
4. Put the client ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Operating

- Run `alembic upgrade head` as a one-off job before rolling out a new version.
- Run at least two replicas behind the TLS-terminating proxy, and set `FORWARDED_ALLOW_IPS` to the proxy addresses.
- `/healthz` reports the process is up; `/readyz` reports database reachability and an active signing key.
- Logs are JSON on stdout, one line per request, with `request_id` (also returned as `X-Request-ID`).
- Rate limits are per replica and held in memory.
