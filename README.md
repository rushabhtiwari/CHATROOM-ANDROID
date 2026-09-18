# Central Platform

Central Platform is an internal employee platform that unifies identity, access control, and app launching into a single experience. It gives employees one sign-in, one dashboard, and a clear view of the applications they are allowed to use. Administrators manage users, departments, apps, role grants, overrides, and audit history centrally.

This repository is a multi-service platform made up of:

- Identity Service: a FastAPI-based OpenID Connect provider and access authority
- Portal: a Next.js application launcher and admin console
- Modules: companion internal tools and department workspaces that are registered in the platform catalog
- Supporting docs and specs: architecture, design, rollout, and module setup information

The repository language mix is roughly:

- TypeScript: 70.8%
- Python: 24.5%
- HTML: 3.1%
- CSS: 0.9%
- Shell: 0.4%
- JavaScript: 0.2%
- Other: 0.1%

---

## Table of Contents

- Overview
- Goals and business value
- Architecture
- Repository structure
- Core systems
  - Identity Service
  - Portal
  - Modules
- Technology stack
- Local development
- Quick start
- Environment and configuration
- Security model
- Testing and validation
- Deployment guidance
- Troubleshooting
- Documentation map
- Notes for contributors

---

## Overview

Central Platform solves a common internal-software problem: employees need to access many enterprise tools, but those tools often require separate logins and separate access decisions.

This platform centralizes that by:

- authenticating users once through a single identity provider
- evaluating access using department membership and per-user exceptions
- showing only the apps the user is allowed to open
- signing users into apps automatically via OIDC
- giving admins a single place to manage users, grant rules, and app registrations

It is designed for a company environment where apps are not all built in one codebase and where consistent role-based access is important.

---

## Goals and business value

The project aims to provide:

- single sign-on (SSO) across all internal apps
- centralized user and department management
- app catalog management
- centralized role resolution
- per-user grant/deny overrides
- one admin console for access governance
- auditability for access-related events
- consistent UX for internal app discovery

This is especially valuable in organizations where:
- apps live on different ports or domains
- departments change often
- not everyone should see the same apps
- access must be centrally reviewed and audited

---

## Architecture

The system is organized as a platform with a core identity layer and optional app modules.

```text
                         Google Workspace
                               │
                       upstream OIDC
                               │
                 ┌─────────────▼─────────────┐
                 │ Identity Service           │
                 │ FastAPI + Authlib          │
                 │ OIDC provider + admin API  │
                 └─────────────┬─────────────┘
                               │
                         PostgreSQL 16
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
┌──────▼──────┐        ┌───────▼────────┐       ┌───────▼─────────┐
│ Portal       │        │ Department     │       │ Connected apps  │
│ Next.js      │        │ modules        │       │ OIDC clients    │
│ :3000        │        │ :5174, etc.    │       │ and APIs        │
└──────────────┘        └────────────────┘       └─────────────────┘
```

### Core principle

The identity service remains the source of truth for:
- who the user is
- what department(s) they belong to
- what app they can access
- what role they have in that app
- what exceptions override the standard role

Applications integrate with that identity layer through OIDC and receive a role-specific token.

---

## Repository structure

```text
Central-Platform/
├── README.md
├── docker-compose.yml
├── .gitignore
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   ├── 2026-09-16-central-platform-sso-design.md
│       │   ├── 2026-09-17-app-catalog-and-launcher-design.md
│       │   └── 2026-09-17-workspace-redesign-design.md
│       └── plans/
├── identity/
│   ├── app/
│   ├── migrations/
│   ├── tests/
│   ├── Dockerfile
│   ├── README.md
│   ├── pyproject.toml
│   └── .env.example
├── portal/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── e2e/
│   ├── README.md
│   ├── package.json
│   └── .env.example
├── modules/
│   ├── README.md
│   ├── start-modules.ps1
│   ├── open-departments.sql
│   ├── pact-automation/
│   ├── kiran-payment/
│   └── kiran-mgmt/
```

---

## Core systems

## 1) Identity Service

The `identity/` directory contains the central identity provider.

It is built with:
- Python
- FastAPI
- SQLAlchemy
- Alembic
- Authlib
- PostgreSQL

### Responsibilities

The identity service handles:
- Google Workspace login / user authentication
- OpenID Connect discovery and endpoints
- auth code flow
- token issuance
- refresh flow
- userinfo claims
- signing keys and JWKS
- access resolution for apps
- department memberships
- app registrations and roles
- overrides
- audit logging
- admin APIs

### Important files

- `identity/app/main.py` — app factory and route registration
- `identity/app/access.py` — role access resolution logic
- `identity/app/routes/oidc.py` — OIDC authorize/token endpoints
- `identity/migrations/versions/0002_app_catalog.py` — seeded app catalog
- `identity/migrations/versions/0003_pact_automation_app.py` — PACT app registration
- `identity/pyproject.toml` — Python dependencies and tool config

### Identity design principles

The repo documents that:
- users are never hard-deleted; they are suspended instead
- access decisions are app-scoped
- admins can grant or deny access per user and per app
- overrides may expire
- the app role is computed from the highest-ranked department grant or override
- system apps are treated specially
- the portal's own route is protected by central auth rather than local bypass

---

## 2) Portal

The `portal/` directory contains the main launcher and admin portal.

It is a Next.js app with:
- App Router
- React 19
- TypeScript
- server-side identity calls
- Auth.js integration

### Responsibilities

The portal:
- shows a personalized app dashboard
- lists apps the user can access
- provides admin tools
- supports app registration
- supports role management
- supports user and department administration
- handles sign-in flow
- reads identity API data server-side

### Key files

- `portal/app/page.tsx` — home page rendering the launcher
- `portal/proxy.ts` — Auth middleware protection
- `portal/lib/identity.ts` — identity API client
- `portal/README.md` — portal-specific full docs

### Portal runtime

Local development:
- portal runs on http://localhost:3000
- identity runs on http://localhost:8000
- PostgreSQL runs on http://localhost:5433

---

## 3) Modules

The `modules/` directory contains internal tools that plug into the platform catalog.

The repo defines several modules:

### a) PACT Automation (`modules/pact-automation`)
This module is a Windows-heavy automation platform for working with PACT RevenU.

It includes:
- a robot that uses Windows UI Automation
- a backend API
- a console
- batch processing flows
- document verification steps
- CSV/XLSX intake and validation
- dry-run support
- safety checks before save

The README for the module explains that it does not click by screenshot; instead, it maps fields and interacts by automation ids and keyboard-driven grid handling.

This module is meant to automate repetitive data entry into ERP forms while verifying the result before saving.

### b) Kiran Payment / KiranOS (`modules/kiran-payment`)
This is a workspace and operations console for the business.

It includes:
- department workspaces
- shared chat
- claim/reimbursement workflows
- cost tracking
- calendar
- activity feed
- notifications across departments
- AI assistant integration

It is meant to serve as a company operations console, not only a single app.

### c) KCMS / kiran-mgmt (`modules/kiran-mgmt`)
This module contains a project management stack inspired by Plane/KCMS.

It includes:
- project management
- API and worker services
- live collaboration
- project boards
- PostgreSQL
- Valkey
- MinIO
- Celery workers
- proxy and reverse proxy layer

This module is run as a single containerized stack locally and exposed on port 3020.

---

## Technology stack

### Platform core
- TypeScript
- Next.js 16
- React 19
- FastAPI
- SQLAlchemy
- Alembic
- Authlib
- PostgreSQL
- Docker Compose

### Portal
- Next.js 16
- React 19
- TypeScript
- Auth.js
- Server Components
- Vite / Vitest / Playwright

### Identity service
- Python 3.12+
- FastAPI
- Authlib
- SQLAlchemy
- Alembic
- PostgreSQL
- Uvicorn
- Pydantic Settings

### Modules
- PACT Automation: Python, FastAPI, pywinauto, Windows Automation
- Kiran Payment: TypeScript + Python backend + workspace console
- KCMS: Dockerized multi-service stack, Django/Plane-derived stack, worker processes, caches, file storage

---

## Local development

### Prerequisites

For the platform core:
- Docker
- Node.js 24+
- Python 3.12+
- uv (for Python package management)

For module-specific work:
- Windows PowerShell for automation and module startup
- access to module dependencies
- sometimes a Windows session for PACT-driven UI workflows

---

## Quick start

## Start the platform core

```bash
git clone <repository-url>
cd Central-Platform

docker compose up --build
```

This runs:
- Postgres
- Identity service
- portal-ready infrastructure

### Local URLs
- Identity: http://localhost:8000
- Portal: http://localhost:3000
- Postgres: localhost:5433

---

## Start the identity service from source

```bash
docker compose up -d postgres
cd identity
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:create_app --factory --reload
```

This gives you the identity service in a direct development loop.

---

## Start the portal from source

```bash
docker compose up -d
cd portal
cp .env.example .env.local
npm install
npm run dev
```

Then visit:
- http://localhost:3000

---

## Start the modules

From the repository root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\modules\start-modules.ps1
```

To start with KCMS support:

```powershell
powershell -ExecutionPolicy Bypass -File .\modules\start-modules.ps1 -Kcms
```

To stop module processes:

```powershell
powershell -ExecutionPolicy Bypass -File .\modules\start-modules.ps1 -Stop
```

The script starts modules detached and logs output to `%TEMP%\central-modules\`.

---

## Configuration

## Identity config

Key variables include:

- `ENVIRONMENT`
- `COMPANY_DOMAIN`
- `ISSUER_URL`
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `KEY_ENCRYPTION_KEY`
- `SESSION_SECRET`
- `INITIAL_ADMIN_EMAILS`
- `PORTAL_URL`
- `PORTAL_CLIENT_SECRET`
- `DEV_LOGIN_ENABLED`
- `FORWARDED_ALLOW_IPS`

### Example usage

```bash
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

This generates a Fernet key for encrypting private signing keys.

---

## Portal config

Important portal env variables include:

- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_ISSUER`
- `AUTH_CLIENT_SECRET`
- `IDENTITY_API_URL`

Example:

```bash
npx auth secret
```

---

## Environment notes

This repository expects secrets to be kept out of source control. Do not commit:
- `.env`
- `.env.local`
- API keys
- client secrets
- encryption keys
- production database credentials

---

## Access control model

The identity service uses a role-based access system based on:
- user status
- app status
- admin status
- system app special handling
- per-user overrides
- department membership grants

The access decision order is:

1. suspended user => no access
2. disabled app => no access
3. system app => grant lowest role if present
4. deny override => no access
5. grant override => app-specific role
6. highest department role wins
7. otherwise no access

This logic is implemented in `identity/app/access.py`.

---

## Authentication and SSO flow

The platform is designed around centralized, standards-based identity.

### Typical flow

1. User tries to access a portal or app
2. Portal redirects to the identity service
3. The identity service validates the redirect and client metadata
4. A Google Workspace login flow is used
5. User is provisioned or updated
6. Role is resolved
7. Authorization code is issued
8. Client exchanges code for token
9. Refresh token is used when needed

### Supported identity behaviors

- OIDC discovery
- authorization code flow
- refresh tokens
- role-bearing JWTs
- logout / RP-initiated logout
- userinfo endpoint
- JWKS
- per-app access evaluation
- signed-in sessions

---

## Security model

The platform treats security as a central concern, not a UI concern.

### Security controls documented in the repo

- exact redirect URI matching
- no wildcard redirect URIs
- PKCE enforcement
- state and nonce validation
- short-lived authorization codes
- hashed client secrets
- encrypted private signing keys
- access token expiry
- refresh token rotation
- session revocation
- user suspension support
- audit logging
- admin API authorization checks
- strict proxy trust configuration

### Additional app-level safety

For the automation modules:
- KPAC does not log into PACT itself
- it uses Save Draft rather than direct Post
- it supports dry-run mode
- it verifies values before saving
- it prevents risky saves without approval

---

## Testing

### Identity tests

```bash
cd identity
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

### Portal tests

```bash
cd portal
npm test
npm run lint
npm run typecheck
npm run format:check
npm run test:e2e
```

The repo includes:
- unit tests
- component tests
- integration-style tests
- end-to-end tests with Playwright

---

## Deployment guidance

### Identity deployment

Recommended:
- run PostgreSQL 16+
- run migrations via Alembic before rolling out
- deploy at least 2 replicas behind a TLS-terminating reverse proxy
- use health checks
- preserve request IDs in logs
- keep secrets in a secure secret manager

### Portal deployment

```bash
docker build -t central-platform-portal ./portal
docker run -p 3000:3000 --env-file portal.env central-platform-portal
```

### Module deployment

Modules are deployed differently:

- `kiran-payment` is a browser and backend app run beside the platform
- `pact-automation` runs on Windows and interacts with the Windows desktop
- `kiran-mgmt` runs as a multi-container stack with its own database, redis, workers, and storage

---

## Troubleshooting

## Portal sign-in loop

Check:
- `AUTH_ISSUER` matches the identity service issuer URL
- `AUTH_CLIENT_SECRET` matches the identity service registration
- `IDENTITY_API_URL` is correctly reachable
- app cookies are enabled
- upstream configuration is valid

## Identity service fails to start

Check:
- Postgres is healthy
- migration state is correct
- `KEY_ENCRYPTION_KEY` is set
- `SESSION_SECRET` is set
- `DEV_LOGIN_ENABLED` is not set in production

## User cannot access an app

Verify:
- user status
- department memberships
- app status
- department grants
- user-specific overrides
- role resolution rules

## PACT automation cannot run

Check:
- port 8765 is free
- the target PACT window is open
- the user is logged in
- the selected profile matches the form
- the Windows session is active

---

## Documentation map

This repo contains several useful docs:

- `identity/README.md` — identity service development and operations
- `portal/README.md` — portal application development and setup
- `modules/README.md` — module map and startup notes
- `modules/pact-automation/README.md` — PACT automation flow, robot safety, and automation details
- `modules/kiran-payment/README.md` — department workspaces, chat, reimbursements, and calendar flows
- `docs/superpowers/specs/2026-09-16-central-platform-sso-design.md` — main platform architecture and protocol design
- `docs/superpowers/specs/2026-09-17-app-catalog-and-launcher-design.md` — app catalog and portal design
- `docs/superpowers/specs/2026-09-17-workspace-redesign-design.md` — UI redesign and workspace design

---

## Notes for contributors

When contributing to this repository:

- keep the identity service and portal consistent with the repo’s centralized design
- do not bypass access control in the UI
- respect module isolation
- update docs when changing runtime behavior
- keep migrations clear and intentional
- preserve access auditability
- avoid hard-coded app access rules in UI layers
- keep security decisions in the identity service

Good contributors treat the identity service as the central authority and the portal as a client that presents access decisions to the user.

---

## Summary

Central Platform is a modern internal platform built around:
- centralized identity
- application cataloging
- access governance
- role-based app launches
- modular internal tooling
- enterprise-ready security patterns

It is designed to unify the experience of operating multiple business tools behind a single trusted identity, single admin surface, and single application launcher.

If you want, I can also provide:
- a shorter executive-summary README
- a more polished GitHub-style README with badges and screenshots
- a README tailored specifically for developers, ops, or stakeholders
- a README in a single compact file ready to paste into the repo root
