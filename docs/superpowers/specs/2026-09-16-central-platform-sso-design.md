# Central Platform — Identity Service & Portal Design

**Date:** 2026-09-16
**Status:** Approved in brainstorming, pending written-spec review

## 1. Goal

Give employees one place to sign in and reach every internal platform (sales, CRM, invoicing, finance, …) they are entitled to, with one click and no second login. Access is managed centrally by department with per-person exceptions, and each platform receives the user's role for that platform.

### Scope of this spec

In scope:
- **Identity service** (FastAPI): OpenID Connect provider federating Google Workspace, access-resolution rules, admin API, audit log.
- **Portal** (Next.js): app launcher dashboard and admin console.
- **Reference integrations**: an example Next.js app and an example Python API, plus an integration guide.

Out of scope (each existing platform's migration is its own later piece of work): modifying the existing platforms, back-channel (instant) logout, fine-grained per-action permissions, multiple admin tiers, shared SDK packages, a specific hosting provider.

### Terminology

- **Company domain** — the Google Workspace domain, configured as `COMPANY_DOMAIN` (example below: `yourco.com`). All services live on subdomains of it.
- **App** — any platform registered with the identity service, including the portal itself.
- **Role** — a named, ranked access level defined per app (e.g. `viewer`, `manager`).

## 2. Decisions summary

| Topic | Decision |
|---|---|
| SSO model | True SSO: sign in once, apps open already signed in |
| Hosting topology | All apps on subdomains of the company domain |
| Identity source | Google Workspace only; no local passwords |
| Identity provider | Built in-house on FastAPI, using **Authlib** for all OAuth/OIDC protocol and JOSE work — no hand-written token or crypto code |
| Authorization granularity | App access + one role per app, carried in the token |
| Assignment | Department-based, with per-person grant/deny exceptions |
| Multiple departments | Allowed; highest-ranked role wins |
| Grant exception semantics | Replaces the department-derived role (may be lower) |
| User provisioning | Just-in-time on first Google sign-in, with no access |
| Revocation latency | Up to 15 minutes (access-token lifetime) is acceptable |
| Admin model | Single `is_admin` flag; bootstrap via `INITIAL_ADMIN_EMAILS` |
| Deployment | Docker images + PostgreSQL, provider-agnostic |

## 3. Architecture

```
                 Google Workspace (hd = COMPANY_DOMAIN)
                              ▲
                              │ upstream OIDC sign-in
┌─────────────────────────────┴───────────────────────────┐
│ auth.yourco.com — Identity Service (FastAPI)            │
│  • OIDC provider: /authorize /token /userinfo /jwks     │
│    /logout /.well-known/openid-configuration            │
│  • User API: /me, /me/apps                              │
│  • Admin API: /admin/*                                  │
│  • Audit log                                            │
└───────────────┬─────────────────────────────────────────┘
                │ PostgreSQL
   ┌────────────┼───────────────┬───────────────┐
   ▼            ▼               ▼               ▼
portal.yourco.com  sales.yourco.com  invoicing.yourco.com  …
Next.js            Next.js front end ─Bearer token─▶ Python API
```

### Components

**Identity service** — sole source of truth for identity and access. Nothing else stores access rules.
- Stack: Python 3.12+, FastAPI, SQLAlchemy 2.x, Alembic, Authlib, PostgreSQL.
- Stateless across instances (all state in Postgres), so it runs as ≥ 2 replicas.

**Portal** — an ordinary OIDC client of the identity service (`client_id=portal`); it has no privileged back door.
- Stack: Next.js (App Router, current stable), Auth.js OIDC provider, TypeScript.
- Calls the identity service's user and admin APIs with the signed-in user's access token.

**Connected apps** — each is a registered OIDC client with its own `client_id`, secret, and exact redirect URIs.

### Repository layout

```
identity/                FastAPI service, Alembic migrations, pytest suite
portal/                  Next.js portal + admin console, Playwright tests
examples/nextjs-app/     Reference Next.js front end (Auth.js)
examples/python-api/     Reference FastAPI API validating bearer tokens
docs/integrating-an-app.md
docker-compose.yml       postgres + identity + portal + examples (local dev)
```

## 4. Data model

### 4.1 Access tables

```
users
  id (uuid pk), google_sub (unique), email (unique), name, avatar_url,
  status (active | suspended), is_admin (bool),
  created_at, last_login_at

departments
  id, slug (unique), name

user_departments
  user_id, department_id            (pk: both)

apps
  id, slug (unique), name, description, icon, launch_url,
  client_id (unique), client_secret_hash,
  redirect_uris (text[]), post_logout_redirect_uris (text[]),
  status (active | disabled), is_system (bool; true for portal)

app_roles
  id, app_id, key, label, rank (int)   (unique: app_id+key, app_id+rank)

department_app_access
  department_id, app_id, app_role_id  (pk: department_id+app_id)

user_app_overrides
  id, user_id, app_id, effect (grant | deny),
  app_role_id (required iff effect = grant),
  reason (required), created_by, created_at, expires_at (nullable)
  (unique: user_id+app_id — at most one override per user per app)
```

Constraints:
- `app_role_id` in `department_app_access` and `user_app_overrides` must belong to the same `app_id` (enforced in the service layer and by a composite foreign key on `(app_id, app_role_id)`).
- Users are never hard-deleted; they are suspended, preserving audit history.
- An app role referenced by any access rule or override cannot be deleted.

### 4.2 Access resolution

`resolve_role(user, app, now) -> role | None`:

1. `user.status == suspended` → **None**.
2. `app.status == disabled` → **None**.
3. `app.is_system` (the portal) → the app's lowest-ranked role. Every active user may use the portal; `is_admin` separately gates admin features.
4. Active override exists (`expires_at` is null or `> now`):
   - `deny` → **None**
   - `grant` → **override role**
5. Otherwise, over all `department_app_access` rows for the user's departments and this app → role with the **highest rank**.
6. No rows → **None**.

Expired overrides are ignored (not deleted), so they remain visible in the admin console history.

The admin console exposes this function as an "effective access" view per user, showing each app's resolved role **and the rule that produced it** (e.g. "via department Sales", "via exception by admin@…, expires 30 Nov").

### 4.3 Protocol tables

```
auth_sessions         id, user_id, token_hash, created_at, last_seen_at,
                      idle_expires_at, absolute_expires_at, revoked_at
authorization_codes   code_hash, client_id, user_id, session_id, redirect_uri,
                      scope, nonce, code_challenge, created_at, expires_at, used_at
refresh_tokens        id, token_hash, family_id, client_id, user_id, session_id,
                      created_at, expires_at, used_at, revoked_at
signing_keys          kid, public_jwk, private_key_encrypted, created_at,
                      activated_at, retired_at
audit_log             id, at, actor_user_id (nullable), event, subject_user_id,
                      app_id, detail (jsonb), request_id, ip
```

All tokens, codes, session identifiers and client secrets are stored only as hashes. Private signing keys are encrypted with `KEY_ENCRYPTION_KEY`.

### 4.4 Admin bootstrap

`INITIAL_ADMIN_EMAILS` (comma-separated). When a user whose email is in this list signs in and `is_admin` is false, it is set to true and audited. Removing an email from the variable does not revoke admin; that is done in the console.

## 5. Protocol & flows

### 5.1 Lifetimes

| Item | Lifetime |
|---|---|
| Authorization code | 60 s, single use |
| Access token (JWT) | 15 min |
| ID token | 15 min |
| Refresh token | Rotated on every use; family expires after 12 h idle or 24 h absolute |
| Auth session (`auth.yourco.com` cookie) | 12 h idle, 24 h absolute |

### 5.2 Sign-in (no existing session)

1. Client redirects to `/authorize` with `response_type=code`, `client_id`, exact `redirect_uri`, `scope=openid email profile`, `state`, `nonce`, `code_challenge` (S256). PKCE is mandatory for all clients.
2. Identity service validates client and redirect URI **before** any redirect; on failure it renders an error page and never redirects.
3. No valid session → redirect to Google with `hd=COMPANY_DOMAIN`, its own `state`/`nonce`/PKCE.
4. `/google/callback`: verify Google ID token server-side; require `hd == COMPANY_DOMAIN` and `email_verified == true`.
5. Upsert user by `google_sub` (refresh `email`, `name`, `avatar_url`, `last_login_at`); apply admin bootstrap; reject suspended users.
6. Create `auth_session`; set cookie: host-only on `auth.yourco.com`, `Secure`, `HttpOnly`, `SameSite=Lax`.
7. Resume the original authorization request (step 5.3, from the access check).

### 5.3 Sign-in (existing session — the SSO path)

1. Client redirects to `/authorize` as above.
2. Valid session found; no Google prompt. Session `last_seen_at` is extended.
3. `resolve_role(user, app)`:
   - None → render "You don't have access to {App}" with a "Back to portal" link; audit `access_denied`. No redirect to the client.
   - role → issue authorization code, redirect to `redirect_uri?code=…&state=…`.
4. Client back end calls `POST /token` (`grant_type=authorization_code`, `client_secret_basic` or `client_secret_post`, `code_verifier`) → `id_token`, `access_token`, `refresh_token`.

### 5.4 Token contents

ID token and access token are RS256 JWTs with `kid` header.

```json
{
  "iss": "https://auth.yourco.com",
  "aud": "invoicing",
  "sub": "<users.id uuid>",
  "email": "priya@yourco.com",
  "name": "Priya Sharma",
  "picture": "https://…",
  "role": "viewer",
  "sid": "<auth_sessions.id>",
  "iat": 0, "exp": 0,
  "nonce": "…"
}
```

- `aud` is always the requesting client's `client_id`.
- `role` is the role for **that app only**; a token never lists access to other apps.
- `nonce` is present in the ID token only.
- `/userinfo` returns the same user claims for a valid access token.

### 5.5 Refresh

- `POST /token` with `grant_type=refresh_token` re-runs `resolve_role`. If None, or user suspended, or session revoked → `invalid_grant` and the family is revoked.
- Successful refresh returns a new access token (with current role) and a new refresh token; the old one is marked used.
- A **used** refresh token presented again → revoke the entire family, audit `refresh_reuse_detected`, return `invalid_grant`.
- **Client contract:** on any refresh failure the app ends its local session.

### 5.6 Logout

- `GET /logout` (OIDC RP-initiated logout: `id_token_hint`, `post_logout_redirect_uri` exact-matched, `state`) → revoke the auth session and all refresh tokens bound to that `sid` across every client, clear the cookie, redirect.
- Other apps lose access at their next refresh (≤ 15 min).
- Admin "Sign out everywhere" and "Suspend" revoke all of the user's sessions and refresh tokens.
- Back-channel logout is explicitly deferred; adding it later requires no changes to existing tables beyond per-app `backchannel_logout_uri`.

### 5.7 Signing keys

- On first start with no active key, generate an RSA-2048 key pair and activate it.
- Rotation (admin action): generate a new key, activate it for signing; the previous key is retired but remains in `/jwks` for 24 h, then is removed.
- `/jwks` responses carry `Cache-Control: max-age=300`.

### 5.8 Security requirements

- Exact-match redirect and post-logout URIs; no wildcards.
- PKCE (S256) required for every client, including confidential ones.
- `state` and `nonce` validated end to end (clients validate `nonce` in the ID token).
- Codes single-use; reuse of a code revokes tokens issued from it.
- Client secrets hashed (argon2); shown once at creation or rotation.
- CSRF protection on all state-changing admin API calls (bearer-token only; no cookie auth on `/admin/*`).
- Rate limiting on `/authorize`, `/token`, `/google/callback`.
- HTTPS only; HSTS on all hosts.
- Every sign-in, denial, token-reuse detection and admin change written to `audit_log`.

## 6. APIs

All `/me` and `/admin` endpoints require `Authorization: Bearer <access_token>` with `aud=portal`. `/admin/*` additionally requires `is_admin`, else 403. Every mutating admin call writes an audit entry.

### User API

| Method | Path | Purpose |
|---|---|---|
| GET | `/me` | Current user profile, departments, `is_admin` |
| GET | `/me/apps` | Apps the user can access: slug, name, description, icon, launch_url, role (excludes the portal) |

### Admin API

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/users?query=&department=&status=` | List/search users |
| GET | `/admin/users/{id}` | User detail incl. effective access with reasons |
| PATCH | `/admin/users/{id}` | Update `status`, `is_admin` |
| PUT | `/admin/users/{id}/departments` | Replace department memberships |
| POST | `/admin/users/{id}/signout` | Revoke all sessions and refresh tokens |
| GET/POST | `/admin/users/{id}/overrides` | List / create override |
| PATCH/DELETE | `/admin/overrides/{id}` | Edit / remove override |
| GET/POST | `/admin/departments` | List / create |
| PATCH/DELETE | `/admin/departments/{id}` | Edit / delete (delete blocked while members exist) |
| PUT | `/admin/departments/{id}/access` | Replace the department's app→role grants |
| GET/POST | `/admin/apps` | List / register (POST returns client secret once) |
| GET/PATCH | `/admin/apps/{id}` | Detail / edit (URIs, launch URL, status, metadata) |
| POST | `/admin/apps/{id}/rotate-secret` | New client secret, returned once |
| GET/POST | `/admin/apps/{id}/roles` | List / create roles |
| PATCH/DELETE | `/admin/app-roles/{id}` | Edit / delete (delete blocked while referenced) |
| GET | `/admin/audit?event=&user=&app=&from=&to=` | Paged audit log |
| POST | `/admin/keys/rotate` | Rotate signing key |

The system `portal` app is seeded by the initial migration with a single role `user` (rank 10). It cannot be disabled or deleted, overrides cannot target it (to cut someone off, suspend them), and its redirect URIs are set from `PORTAL_URL`.

## 7. Portal

### Pages

| Route | Who | Content |
|---|---|---|
| `/` | All users | Grid of app tiles from `/me/apps`; tile opens `launch_url` in a new tab. Empty state: "You don't have access to any apps yet — ask your admin." |
| `/admin/users` | Admins | Searchable user list with department and status filters |
| `/admin/users/[id]` | Admins | Departments, overrides (with expiry and reason), effective access table with reasons, suspend, make admin, sign out everywhere |
| `/admin/departments` | Admins | Departments and their app→role grants |
| `/admin/apps` | Admins | Registered apps |
| `/admin/apps/[id]` | Admins | App settings, redirect URIs, roles, rotate secret, which departments have access |
| `/admin/audit` | Admins | Filterable audit log |

- Admin navigation is shown only when `/me` reports `is_admin`; the API enforces it regardless.
- The portal holds tokens server-side (Auth.js session); access tokens never reach browser JavaScript.
- The portal follows the same refresh-or-sign-out client contract as every app.

## 8. App integration

### 8.1 Registration
An admin registers the app in the portal: name, slug, icon, launch URL, redirect URI(s), post-logout URI(s), roles with ranks, and department grants. The client secret is displayed once.

### 8.2 Next.js front end (primary pattern)
- Auth.js with a generic OIDC provider pointed at `https://auth.yourco.com` via discovery; `checks: ["pkce", "state", "nonce"]`.
- `jwt` callback stores `access_token`, `refresh_token`, `expires_at`, `role`; refreshes when expired; on refresh failure returns a session error that forces sign-out.
- Middleware redirects unauthenticated requests straight to `signIn("yourco")`; the app has no local sign-in page.
- Server-side calls to the app's Python API forward `Authorization: Bearer <access_token>`.

### 8.3 Python API behind Next.js (primary pattern)
- Validates bearer JWTs locally: signature against cached `/jwks` (refetch on unknown `kid`), `iss == https://auth.yourco.com`, `aud == <app client_id>`, `exp` not passed (≤ 30 s leeway).
- Uses Authlib's JOSE support (`authlib.jose`) — no hand-written verification.
- Exposes the claims (`sub`, `email`, `role`) to route handlers via a FastAPI dependency; missing/invalid token → 401.
- No per-request call to the identity service.

### 8.4 Python app with its own pages (secondary pattern)
Authlib OAuth client registered with `server_metadata_url` discovery; same refresh-or-sign-out contract. Documented in the guide; no example app in this scope.

### 8.5 Using the role
Apps replace their own role/permission lookups with the token's `role`. The app decides what each role may do; the identity service decides which role the user has.

### 8.6 Linking existing user records
1. Add `identity_sub` (nullable, unique) to the app's users table.
2. On sign-in: match by `identity_sub`; else match by `email` and store `identity_sub`; else create a local user.
3. Remove the app's password login once linking is verified.
Existing foreign keys to the app's users table are untouched.

### 8.7 Deliverables
- `examples/nextjs-app` + `examples/python-api`: a working front end + API pair that shows the user's role, calls a protected API endpoint, and displays a role-gated action.
- `docs/integrating-an-app.md`: registration and code checklist, leading with the Next.js + Python API pattern.

## 9. Error handling

| Situation | Behaviour |
|---|---|
| Google account outside `COMPANY_DOMAIN` or unverified | Error page "Use your company Google account"; audit `login_denied` |
| Suspended user | Error page "Your account is suspended — contact an admin"; audit `login_denied` |
| No access to app | Error page with "Back to portal"; audit `access_denied` |
| Unknown client / redirect URI mismatch | Error page; never redirects |
| Invalid, expired or reused code; PKCE mismatch | `/token` → `invalid_grant` (RFC 6749 error format) |
| Refresh token reuse | Revoke family; audit `refresh_reuse_detected`; `invalid_grant` |
| App disabled | Hidden from dashboards; `/authorize` and refresh refused |
| Google unavailable | Error page "Sign-in temporarily unavailable"; existing sessions and refreshes continue |
| Identity service unavailable | New sign-ins and refreshes fail; APIs keep validating unexpired tokens from cached keys. Mitigated by ≥ 2 replicas and health checks. |
| Admin API validation failure | 422 with field-level errors; conflicts (e.g. deleting a referenced role) → 409 with explanation |

Every error page and API error includes a `request_id` that is also present in the structured logs.

## 10. Testing

- **Access resolution (pytest, unit):** table-driven coverage of suspended user, disabled app, system app, deny, grant (higher and lower than department role), expired overrides, multiple departments, no access.
- **Protocol (pytest, against real Postgres):** full code → token → userinfo → refresh → logout; negatives: redirect URI mismatch, missing/invalid PKCE, expired code, code reuse, wrong client secret, refresh reuse, refresh after access removal, refresh after suspension, token with wrong `aud`, tampered signature, validation across key rotation.
- **Google callback:** Google's ID-token verification is mocked at the boundary; tests cover wrong `hd`, unverified email, new vs returning user, admin bootstrap.
- **Admin API:** 401/403 enforcement, validation and conflict rules, audit entry per mutation.
- **Portal:** component tests for dashboard and admin screens; Playwright end-to-end using dev login: sign in → see tiles → open example app → admin removes access → example app signs the user out after refresh.
- **Reference integration in CI:** `examples/nextjs-app` + `examples/python-api` run against the identity service; breaking the integration contract fails the build.
- **Pre-production:** run the OpenID Foundation conformance suite (Basic OP profile) against staging.

### Dev login
`DEV_LOGIN_ENABLED=true` adds a "sign in as test user" page to the identity service that bypasses Google, with seeded users, departments and apps. The service **refuses to start** if dev login is enabled while `ENVIRONMENT=production`.

## 11. Deployment

- Images: `identity` and `portal` (plus example images for CI/local only).
- PostgreSQL 16+ (managed or self-hosted).
- Hosts: `auth.<COMPANY_DOMAIN>`, `portal.<COMPANY_DOMAIN>` behind a TLS-terminating reverse proxy; HSTS enabled. The identity service trusts `X-Forwarded-*` only from configured proxy addresses.
- Identity service runs ≥ 2 replicas; exposes `/healthz` (process up) and `/readyz` (database reachable, active signing key present).
- Migrations: `alembic upgrade head` runs as a separate one-off job before rolling out a new version.
- Logs: structured JSON to stdout with `request_id`.
- Local: `docker compose up` starts Postgres, identity (dev login on), portal and examples.

### Configuration

| Variable | Service | Purpose |
|---|---|---|
| `ENVIRONMENT` | both | `development` / `staging` / `production` |
| `COMPANY_DOMAIN` | identity | Allowed Google Workspace domain |
| `ISSUER_URL` | identity | e.g. `https://auth.yourco.com` |
| `DATABASE_URL` | identity | Postgres connection |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | identity | Upstream Google OIDC |
| `KEY_ENCRYPTION_KEY` | identity | Encrypts private signing keys |
| `INITIAL_ADMIN_EMAILS` | identity | Admin bootstrap |
| `PORTAL_URL` | identity | Portal redirect / post-logout URIs and "Back to portal" links |
| `PORTAL_CLIENT_SECRET` | identity, portal | Portal's OIDC client secret |
| `TRUSTED_PROXIES` | identity | Addresses allowed to set forwarded headers |
| `DEV_LOGIN_ENABLED` | identity | Dev-only test sign-in |
| `AUTH_ISSUER`, `AUTH_SECRET`, `IDENTITY_API_URL` | portal | Auth.js and API configuration |

Secrets are supplied via environment or a secrets manager; none are committed.

## 12. Rollout

1. Identity service, portal and reference apps working locally with dev login; full test suite green.
2. Staging with real Google sign-in; conformance suite passes; integrate **one** low-risk existing platform.
3. Production; integrate remaining platforms one at a time, removing each platform's own login only after user linking is verified.
