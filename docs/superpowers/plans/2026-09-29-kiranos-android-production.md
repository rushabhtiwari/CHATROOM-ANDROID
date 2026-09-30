# KiranOS Android: Production Plan

> This is the working reference for taking the KiranOS Android app from pilot to a production-grade internal app.
> - Every item has an ID (for example `SEC-03`), so commits and later task-level plans can refer to it.
> - Tick the box when an item lands.
> - Each phase gets its own detailed plan in this folder when it starts.

**Goal:** a signed Android App Bundle (.aab) that reaches Kiran Cable staff privately through Managed Google Play.
- People sign in with their Google Workspace accounts.
- The app talks over HTTPS to an AWS backend that enforces who may see and do what.
- It has push notifications, crash reporting, backups and a tested release pipeline.
- Dummy data stays in use until the cutover phase.

**Decisions (2026-09-29)**

| Topic | Decision |
|---|---|
| Audience | Kiran Cable staff only: one company, one tenant |
| Sign-in | Google Workspace SSO through the existing `identity/` OIDC service |
| Cloud | AWS, region ap-south-1 (Mumbai) |
| Distribution | Managed Google Play, as a private app |
| Data | Dummy (seed) data until Phase 6 |
| Scope | Android. iOS shares the code, and its signing and APNs come later |

Paths below are relative to `modules/kiran-payment/`, except those starting with `identity/`, `docs/` or `.github/`, which are relative to the repo root.

---

## 1. Context: where the app is today

**The audit.** On 2026-09-29 we audited the mobile app, the FastAPI backend and the shared console code.

**What works.** The app works as a demo: chat, AI summaries, photo upload, receipt reading into claims, Google Meet and Calendar, and orders and dispatches.

**How v1.0 is built.** v1.0 is a "standalone" APK:
- A fake server runs inside the app (`mobile/src/local/`).
- Data lives only on the phone.
- OpenAI and Google credentials are baked into the JavaScript bundle.

### Production blockers (P0)

| # | Problem | Where |
|---|---|---|
| 1 | The live OpenAI key, Google client secret and refresh tokens are inside the v1.0 APK, which anyone can download from the public repo | `mobile/scripts/build-standalone.mjs`, `mobile/src/local/config.ts` |
| 2 | There is no sign-in. Anyone can pick any user on the Me screen, and the server trusts the `actor`/`role`/`user` values the client sends | `mobile/src/screens/MeScreen.tsx:94`, `backend/app/routers/chat.py:51`, `backend/app/models.py:242` |
| 3 | The server sends every chat change, DMs included, to every user. `/api/state` sends every employee's claims and bank details to everyone. `/uploads` is public | `backend/app/chat_log.py:126`, `backend/app/routers/state.py`, `backend/app/main.py:62` |
| 4 | An employee can approve their own claim, because role permissions aren't tied to the claim's current status | `backend/app/workflow.py:69` with `:79` |
| 5 | CI publishes a debuggable debug APK. It is signed with a key that is committed to git, and the password is in the README | `.github/workflows/android-build.yml:125`, `mobile/android/app/kiranos-test.p12` |
| 6 | Everything travels over plain HTTP. `allowBackup=true` copies the unencrypted local data to cloud backup | `mobile/android/app/src/main/AndroidManifest.xml:9,14`, `mobile/android/app/src/main/res/xml/network_security_config.xml:7` |
| 7 | The backend has four structural problems (see the list below) | `backend/app/store.py`, `backend/app/routers/receipts.py:95`, `backend/app/events.py:44`, `backend/app/routers/chat.py:79` |
| 8 | Nothing sends push notifications and there is no crash reporting. There is no error boundary, so a startup error leaves the app stuck on the splash screen | `mobile/src/App.tsx:64`, `mobile/src/main.tsx:27` |

The backend problems behind blocker 7:
- It runs as one process on JSON files and SQLite, stored inside a OneDrive-synced folder.
- It has no logs, no backups, no container and no CI tests.
- Receipt reading blocks every other request while it runs.
- Clients dropped for being slow get no more data and never reconnect.

### What already exists and gets reused

- **`identity/` service.** An OIDC provider over Google Workspace. It already has:
  - per-app roles, an audit log and refresh-token rotation;
  - Alembic migrations;
  - JSON logs with request IDs (`identity/app/observability.py`) and a rate limiter (`identity/app/ratelimit.py`);
  - `/healthz` and `/readyz`, and a non-root Dockerfile;
  - a settings check that refuses unsafe production config (`identity/app/config.py`).

  The contract for apps that use it is in `docs/superpowers/specs/2026-09-16-central-platform-sso-design.md` §8.
- **Chat sync protocol.** An operation log with idempotent ids, an outbox, retries and reconnect backoff (`docs/superpowers/specs/2026-09-28-chat-server-design.md`, `master-frontend/vd/src/lib/chat-server-log.ts`).
- **Claims logic.** The claim workflow, policy flags and AI extraction with confidence scores (`backend/app/workflow.py`, `backend/app/extraction.py`).
- **Native shell.** Back button, camera downscaling, file-backed storage and push plumbing (`mobile/src/native/`).
- **Tests.** 242 Vitest cases and 21 pytest tests. `android-smoke` runs on API 33, 35 and 36.

---

## 2. Target architecture (AWS)

```
Android app (.aab from Managed Google Play)
  │  HTTPS only · OAuth 2 + PKCE in the system browser · bearer JWT
  ▼
Route 53 ─ ACM (TLS) ─ AWS WAF ─ Application Load Balancer
  ├─ auth.kirancable.co.in          → ECS Fargate: identity service (×2)
  └─ api.kiranos.kirancable.co.in   → ECS Fargate: KiranOS API (×2+, serves SSE)
                                      ECS Fargate: worker (SQS consumers)
Private subnets:
  RDS PostgreSQL 16 Multi-AZ (identity DB + kiranos DB, point-in-time restore)
  ElastiCache Redis (SSE fan-out pub/sub, rate limits, idempotency keys)
  S3 (attachments, receipts: private, KMS-encrypted, versioned)
    + Lambda (virus scan, thumbnails)
  SQS + dead-letter queue · EventBridge Scheduler (send-later, reminders, SLA escalation)
Secrets Manager + KMS · CloudWatch logs/metrics/alarms · X-Ray (OpenTelemetry)
External: Google Workspace (sign-in; Calendar/Meet via domain-wide delegation)
          · FCM (push) · OpenAI or Amazon Bedrock (AI) · Sentry (crashes)
```

Design choices and why:

- **Keep SSE rather than WebSockets.** The chat protocol and client already use SSE, and the ALB supports it. Redis pub/sub makes it work across replicas. Push notifications handle delivery while the app is in the background, so SSE doesn't have to.
- **Postgres for everything.** Same as `identity/`, using SQLAlchemy 2 and Alembic.
- **ECS Fargate rather than EKS.** Two small services don't justify Kubernetes.
- **Terraform for all infrastructure.** GitHub Actions reaches AWS through an OIDC role, so there are no long-lived AWS keys.
- **Three environments:**
  - `dev`: Docker Compose on a laptop, with Postgres, Redis and MinIO.
  - `staging`: AWS, dummy data, resettable.
  - `production`.

  Staging and production live in separate AWS accounts under AWS Organizations.
- **Data stays in India.** The primary region is ap-south-1, and disaster-recovery copies go to ap-south-2 (Hyderabad).
- **Starting size.** This should cover about 1,000 staff; confirm the headcount (§6).
  - API: 2 tasks of 0.5 vCPU / 1 GB each. Worker: 1 task.
  - RDS: `db.t4g.medium`, Multi-AZ. Redis: `cache.t4g.small`.
  - The API autoscales on CPU and on open connections.

---

## 3. Workstreams

### SEC: Containment and secrets (first)

- [ ] **SEC-01** Rotate the OpenAI key. In Google Cloud, reset the OAuth client secret and revoke the refresh tokens baked into v1.0. *Owner: repo owner; this needs the provider consoles.*
- [ ] **SEC-02** Remove the v1.0 release asset or make the repo private again. Rotating keys isn't enough while builds with keys can be downloaded.
- [ ] **SEC-03** Make `mobile/scripts/build-standalone.mjs` bake in no secrets. The standalone build becomes an offline **demo** flavor, where AI, receipt reading and Meet use their existing demo modes.
- [ ] **SEC-04** Stop publishing APKs as public GitHub releases. CI artifacts stay private.
- [ ] **SEC-05** Retire `mobile/android/app/kiranos-test.p12`, because it is public.
  - Create a new upload key that exists only in environment-protected GitHub secrets.
  - Play App Signing holds the app-signing key.
  - Remove the password from `mobile/README.md` and `build.gradle`.
- [ ] **SEC-06** Scan for secrets:
  - run gitleaks in a pre-commit hook and in CI;
  - also scan every built `.aab`/`.apk` for key patterns (`sk-`, `GOCSPX-`, `1//`) and fail the build on a match.
- [ ] **SEC-07** Keep all server secrets in AWS Secrets Manager and inject them into ECS tasks. Outside dev, no secret lives in an image or an env file.

**Done when:** no credential exists in anything a phone can download, and the old credentials are revoked.

### IAM: Sign-in, sessions and identity

Changes to the identity service (`identity/`):

- [ ] **IAM-01** Support public clients: `token_endpoint_auth_method=none`, with PKCE S256 required. Today only confidential clients work (`identity/app/oauth/server.py:172,237`).
- [ ] **IAM-02** Let each client have its own refresh-token lifetime.
  - Today every client is limited to 12 hours idle and 24 hours absolute, which would force phone users to sign in daily.
  - The mobile client gets about 30 days idle and 90 days absolute, with rotation and reuse detection.
- [ ] **IAM-03** Register KiranOS as an app in `identity/`:
  - redirect `https://kiranos.kirancable.co.in/auth/callback`, an Android App Link verified by `/.well-known/assetlinks.json`;
  - roles `employee`, `hr`, `accounts`, `payments`, `sales_ops` and `admin`;
  - department grants.
- [ ] **IAM-04** Add a token revocation endpoint and an admin "sign out everywhere". A disabled Workspace account's refresh fails immediately.
- [ ] **IAM-05** Deploy `identity/` on AWS, which needs Terraform and its secrets.

In the app:

- [ ] **IAM-06** Add a sign-in screen that opens the system browser (Custom Tabs) through AppAuth: `@capacitor-community/generic-oauth2`, or a thin AppAuth-Android plugin. The app never handles passwords.
- [ ] **IAM-07** Handle tokens safely:
  - keep the refresh token in Keystore-backed secure storage, and the access token only in memory;
  - on a 401, refresh once and retry; if that fails, sign out.
- [ ] **IAM-08** Sign out: revoke the refresh token, unregister the push token, and wipe the local database and caches.
- [ ] **IAM-09** Remove the persona switcher from production builds. It stays in the demo flavor only.
- [ ] **IAM-10** Add an optional app lock with BiometricPrompt or the device PIN, on open and before approvals or payouts. Lock automatically after N idle minutes.

In the backend:

- [ ] **IAM-11** Add a FastAPI dependency that validates JWTs locally against cached JWKS using Authlib, following SSO spec §8.3. Every route requires it except the health checks.
- [ ] **IAM-12** Delete `actor`, `role`, `user` and `employeeId` from request bodies and query strings; the server reads them from the token.
- [ ] **IAM-13** Authenticate the live streams too. `EventSource` can't send headers, so switch to fetch-based SSE (for example `@microsoft/fetch-event-source`) with an `Authorization` header. Tokens never go in URLs.
- [ ] **IAM-14** Keep one user directory, following SSO spec §8.6:
  - a `users` table keyed by the identity `sub`, linked by email on first sign-in;
  - the finance employee record becomes a one-to-one extension;
  - this ends the name matching in `master-frontend/vd/src/modules/rts/identity.ts`.

**Done when:**
- an automated test shows every endpoint returns 401 without a valid token;
- the role the app shows comes from the token.

### AUTHZ: Permissions and data isolation, enforced by the server

- [ ] **AUTHZ-01** In chat, the server checks membership and room permissions for all 19 operation types.
  - Port the rules the client applies in `master-frontend/vd/src/lib/chat-ops.ts`.
  - Run both implementations against shared fixtures in `backend/chat_protocol.json`.
- [ ] **AUTHZ-02** Chat reads and live streams are filtered per user:
  - you only get rooms you belong to;
  - DMs go only to their members;
  - invite codes are shown only to room admins.
- [ ] **AUTHZ-03** Claims:
  - transitions are keyed by (current status, role) → allowed next statuses;
  - nobody can approve their own claim;
  - separation of duties: the HR approver, the Accounts approver and the payer must be three different people.
- [ ] **AUTHZ-04** Replace `/api/state` with scoped endpoints:
  - employees see their own claims;
  - HR and Accounts see their queues;
  - Payments sees payouts;
  - bank details go only to Payments, and masked.
- [ ] **AUTHZ-05** Payouts:
  - maker-checker: one person prepares, another approves;
  - idempotency keys;
  - retry is allowed only from FAILED (today a PAID payout can be re-queued, `backend/app/store.py:552`).
- [ ] **AUTHZ-06** The server takes the "read by AI" values from its own stored extraction, tied to the uploader's receipt id. Today the client sends them back (`backend/app/store.py:329`).
- [ ] **AUTHZ-07** Only the server creates notifications. Remove the public `POST /api/notifications`.
- [ ] **AUTHZ-08** Files:
  - stored in a private S3 bucket;
  - downloaded through short-lived presigned URLs, issued only after an access check (room member, or claim owner or approver);
  - `Content-Disposition: attachment` for everything except images;
  - file types allowed by content (magic bytes), not by extension;
  - virus-scanned before anyone can open them;
  - EXIF and GPS data stripped from images.
- [ ] **AUTHZ-09** Orders and dispatches are visible by role and department.
- [ ] **AUTHZ-10** Reset and demo endpoints exist only when `ENVIRONMENT` is dev or staging, and only admins can call them.
- [ ] **AUTHZ-11** Keep an append-only audit log of sign-ins, role changes, approvals, payouts, deletes, exports and admin actions. The actor comes from the token.
- [ ] **AUTHZ-12** Add optimistic locking (a version column) on claims and payouts. If two approvers act at once, one gets a 409.

**Done when:** an authorization matrix test (every endpoint × role × owner/non-owner) passes in CI.

### API: Backend platform

- [ ] **API-01** Move to Postgres with SQLAlchemy 2 and Alembic, managed with `pyproject.toml` and a uv lockfile, on Python 3.12 (as `identity/` does).
- [ ] **API-02** Chat storage:
  - keep the operation log in Postgres with a sequence per room, because the client's sync model depends on it;
  - add query tables for rooms, members and messages;
  - send a snapshot plus a cursor, so a reconnect doesn't replay everything from zero;
  - honour `Last-Event-ID`;
  - page older messages on the server.
- [ ] **API-03** Run several replicas: Redis pub/sub for live-stream fan-out, and rate limits and idempotency keys in Redis.
- [ ] **API-04** Fix the silent streams (`backend/app/events.py:44`, `backend/app/routers/chat.py:79`):
  - when a slow client is dropped, end its stream so it reconnects;
  - cap the number of streams per user;
  - close streams cleanly on shutdown.
- [ ] **API-05** Make all I/O async:
  - use `AsyncAnthropic` and `httpx.AsyncClient`;
  - receipt extraction becomes a queued job (SQS → worker), and its status is pushed to the app.
- [ ] **API-06** The worker and scheduler handle:
  - receipt extraction and push fan-out;
  - send-later on the server, and meeting-start notices;
  - SLA escalations and retention clean-up.
- [ ] **API-07** Validate all input:
  - a global body-size limit, at the ALB/WAF and in middleware;
  - Pydantic limits on every field (amount above 0 with a maximum, text lengths);
  - https-only URLs for links and `meetingUri`;
  - ids generated by the server, with client ids used only as idempotency keys. Today a client's `requestId` can overwrite calendar rows (`backend/app/routers/meet.py:408`).
- [ ] **API-08** Version the API as `/api/v1`, with OpenAPI as the contract. Generate the app's TypeScript types with openapi-typescript. Support app versions N and N−1.
- [ ] **API-09** Hardening:
  - security headers (HSTS, `nosniff`, deny framing) and CORS origins from config;
  - `/docs` turned off in production;
  - generic error messages, with no exception class names and no ".env" hints;
  - `/healthz`, plus `/readyz` checking the DB, Redis and S3.
- [ ] **API-10** Add an `ENVIRONMENT` setting and validate settings at startup, refusing unsafe production config (the same pattern as `identity/app/config.py`).
- [ ] **API-11** Write JSON logs with request IDs (reuse `identity/app/observability.py`). Never log message bodies or personal data. Add OpenTelemetry traces.
- [ ] **API-12** Build a non-root container image (the same pattern as `identity/Dockerfile`), run migrations as a one-off task before each rollout, and shut down gracefully.
- [ ] **API-13** Fix these known bugs:
  - claims filed straight as submitted skip the ledger's pending total (`backend/app/store.py:271` vs `:411`);
  - the year in claim ids is hard-coded (`backend/app/store.py:274`);
  - calendar writes aren't atomic (`backend/app/calendar_store.py:125`);
  - the assistant's model is hard-coded (`backend/app/routers/agent.py:36`).
- [ ] **API-14** Move local development off OneDrive: Docker Compose with Postgres, Redis and MinIO, and no live SQLite in a synced folder.

**Done when:**
- staging runs 2 API replicas behind the ALB;
- killing one replica loses no messages;
- staging passes the load test (QA-08).

### INT: Integrations

AI:

- [ ] **INT-01** Only the server calls the AI. It builds the context from messages the user is allowed to read; today the client sends the context (`master-frontend/vd/src/lib/chat-store.tsx:1941`).
- [ ] **INT-02** Enforce per-user daily quotas and a monthly company budget on the server, based on real token usage. Alert at 80%.
- [ ] **INT-03** Stream real responses, with timeouts and retries with backoff. Model names come from config.
- [ ] **INT-04** Guard against prompt injection:
  - the transcript is marked as untrusted;
  - no tool runs without the user confirming;
  - output is rendered only as text or markdown.
- [ ] **INT-05** AI data policy:
  - choose between OpenAI under zero-retention terms and Claude on Amazon Bedrock in-region (the backend already speaks Anthropic);
  - disclose AI processing in the privacy notice;
  - add an admin switch that turns AI off per room.
- [ ] **INT-06** Add 👍/👎 feedback and citations that link back to the source messages.

Google Meet and Calendar:

- [ ] **INT-07** Replace the single company refresh token with domain-wide delegation.
  - A service account, stored in Secrets Manager, acts as the meeting organizer.
  - Its scopes are limited to Calendar events and Meet spaces.
  - Meetings then sit on the organizer's own calendar, and invites come from them.
- [ ] **INT-08** Close the open invite relay:
  - attendees are limited to the company domain, and external guests need an explicit confirmation;
  - each user has an invite rate limit.
- [ ] **INT-09** Add reschedule, cancel (which notifies attendees), RSVP status and free/busy suggestions. Deleting a meeting in the app cancels it in Google.
- [ ] **INT-10** In production, Google failures show up as errors. The silent fallback to a demo link (`backend/app/routers/meet.py:470`) stays in dev and staging only.

Push:

- [ ] **INT-11** Set up a Firebase project, used only for FCM. `google-services.json` comes from a CI secret. Add a device table and `POST/DELETE /api/v1/devices`.
- [ ] **INT-12** The server sends pushes through FCM HTTP v1.
  - Triggers: new messages, mentions, followed threads, meeting reminders, and approval requests and decisions.
  - It respects mute and notification-level settings on the server side.
  - It uses collapse keys, and a setting controls whether the preview shows message text.
- [ ] **INT-13** On Android:
  - notification channels: Messages, Mentions, Meetings, Approvals, System;
  - handling for pushes that arrive while the app is open, and a tap opens the deep link;
  - token refresh, and unregistering on sign-out.
- [ ] **INT-14** Fix the duplicate push registration: `usePushRouting` runs again on every navigation (`mobile/src/App.tsx:55`).

Orders, dispatches and payments:

- [ ] **INT-15** Build an orders and dispatches API (sub-project #3) on Postgres, seeded with the dummy data. Put it behind an adapter interface so the ERP can plug in later. Read-only first.
- [ ] **INT-16** Payouts stay recorded by hand until a bank integration is chosen: Payments enters the UTR, with maker-checker. No made-up UTRs in production.
- [ ] **INT-17** *(optional)* Use SES to email approval digests and SLA escalations.

### APP: Android client hardening

Security:

- [ ] **APP-01** HTTPS only:
  - `usesCleartextTraffic=false`;
  - a network security config with no cleartext, apart from a debug-only override for local development;
  - `androidScheme: 'https'`.
- [ ] **APP-02** Set `allowBackup=false`, with `dataExtractionRules` that exclude app data.
- [ ] **APP-03** Release build:
  - R8 with `minifyEnabled` and `shrinkResources`, plus Capacitor keep rules;
  - not debuggable, and WebView debugging off;
  - `console.*` calls stripped from the production bundle; errors still go to Sentry.
- [ ] **APP-04** Encrypt local data with SQLCipher-backed SQLite (for example `@capacitor-community/sqlite`), with the key wrapped by the Android Keystore.
  - This replaces the plain-file `localStorage` shim for chat and claims.
  - It is wiped on sign-out.
- [ ] **APP-05** Add a Content-Security-Policy in `mobile/index.html` that allows only the app itself and the API and auth origins.
- [ ] **APP-06** Narrow the FileProvider paths; today they include `external-path "."`.
- [ ] **APP-07** Check Play Integrity at sign-in and before approvals and payouts. The server verifies the verdict.
- [ ] **APP-08** Set `FLAG_SECURE` (no screenshots or preview in recent apps) on bank-detail and payout screens. IT can toggle it by managed configuration.
- [ ] **APP-09** Leave the in-app fake server (`mobile/src/local/`) out of production builds entirely.
- [ ] **APP-10** Remove push-token logging and the forced `credentials: 'include'`; bearer tokens replace cookies.
- [ ] **APP-11** Skip certificate pinning at launch: devices are MDM-managed and traffic is TLS. Revisit if the threat model changes. Pins break when a certificate rotates, which is a common self-inflicted outage.

Reliability:

- [ ] **APP-12** Error handling:
  - a root error boundary plus one per screen;
  - `bootstrap()` wrapped, so a failure hides the splash and shows an error the user can recover from (today the splash hangs, `mobile/src/main.tsx:27`);
  - a global handler for unhandled promise rejections.
- [ ] **APP-13** Storage safety:
  - atomic writes, and keep the previous snapshot;
  - never overwrite saved data with the seed when parsing fails, as happens today (`master-frontend/vd/src/lib/chat-persistence.ts:262`);
  - quota monitoring and attachment cache eviction;
  - "Clear cache" in Settings.
- [ ] **APP-14** Networking:
  - timeouts on every request (AbortController), and retries for idempotent calls;
  - an offline queue with idempotency keys for filing claims;
  - error messages written for people. No more "Is the backend running on :3001?".
- [ ] **APP-15** When camera or photo permission is denied, explain why and offer to open Settings. Today the failure is silent (`mobile/src/native/camera.ts:41`).
- [ ] **APP-16** For long chats: virtualize the message list, use server-made thumbnails and lazy-load images.

Platform:

- [ ] **APP-17** Target SDK 36.
  - Go edge-to-edge with safe-area insets; the opt-out in `mobile/android/app/src/main/res/values-v35/styles.xml` stops working at 36.
  - Check that the back button still behaves under predictive back.
- [ ] **APP-18** Raise minSdk to 26, dropping Android 6 and 7, after checking the company's device fleet.
- [ ] **APP-19** Permissions:
  - use the Android photo picker, so no storage permission is needed;
  - ask for notification permission at a sensible moment (the first chat), not at launch.
- [ ] **APP-20** Add App Links for `https://kiranos.kirancable.co.in/…` (chats, claims, meetings, orders), used by push, email and shared links.
- [ ] **APP-21** Updates:
  - in-app updates through the Play in-app update API (for example `@capawesome/capacitor-app-update`);
  - a minimum version set on the server that forces an update;
  - a maintenance mode.
- [ ] **APP-22** Add a managed configuration schema, so IT can set the API environment, feature toggles and screenshot blocking from the MDM.
- [ ] **APP-23** Act as a share target: accept images and PDFs from other apps into a chat or a new claim.
- [ ] **APP-24** A monochrome icon for themed icons; static shortcuts (New chat, File claim, Calendar); a dark splash screen.

**Done when:**
- a MobSF scan of the release `.aab` has no high findings;
- the OWASP MASVS L1 checklist passes, with L2 controls on the finance screens.

### UX: Product completeness

**Position:** don't chase WhatsApp parity. For an internal app, the value is in:
- approvals inside chat;
- visibility of dispatches;
- AI catch-up on conversations.

Audit, retention and reliability matter more than stickers.

Deliberately **not** built:
- **End-to-end encryption.** It would break audit, legal hold and the AI features. Use TLS plus encryption at rest instead.
- **Own voice or video calling.** Google Meet covers it.
- **Stickers and GIFs.**

**Launch scope (P1)**

| Area | What's missing today, to build |
|---|---|
| Chat | Real delivered/read receipts and a "read by" list; typing indicators; presence and last seen (users can opt out); server-side full-text search with filters; several attachments per message, with upload progress and cancel; inline video; PDF preview; archive per user (today it hides the chat for everyone, `master-frontend/vd/src/lib/chat-ops.ts:579`); mark as unread; pinned chats; "delete for me"; a time limit on edits; report a message; send-later run by the server |
| Settings (Me screen) | Sign out; notification settings (global, per chat, quiet hours); theme (system/dark); language; storage used and clear cache; about/version/licences; privacy policy and terms; help, plus "report a problem" with redacted logs |
| Reimbursements | A "my claims" list with filters; drafts; answer "info requested" and resubmit; withdraw a claim; HR and Accounts queues with bulk approve; push for approvals; duplicate-receipt detection; caps enforced by the server (monthly and per trip, across claims); SLA escalation; GST fields; PDF/CSV export for Accounts |
| Meetings | Reschedule and cancel, synced to Google; RSVP; push reminders; "Meet now" in groups; free/busy; time-zone display |
| Orders & dispatches | Backed by the API; pull to refresh; paging; error states; share into chat |
| AI assistant | Context built by the server; usage shown to the user; an "AI can make mistakes" notice; an off switch per room |
| Accessibility | Text that scales with the system font size (rem units); 48 dp touch targets; TalkBack labels; keyboard focus; AA contrast |
| Languages | Every string extracted; English and Hindi first; dates and numbers in the device locale; Android per-app language |
| Large screens | Rotation, and a two-pane layout at 600 dp and wider |

**After launch (P2 — parked):**
- voice notes, polls and recurring meetings;
- mileage and foreign-currency claims;
- dispatch status updates and proof-of-delivery upload;
- AI tools such as "my claims", order status, and "schedule this" using `master-frontend/vd/src/lib/meeting-intent.ts`;
- chat export and a retention/legal-hold admin UI;
- bank payout integration and message translation.

### DATA: Privacy, compliance and retention

- [ ] **DATA-01** List and classify the data: chat content, receipts (addresses, GSTIN), bank details, AI prompts, device tokens.
- [ ] **DATA-02** Write an employee privacy notice that covers AI processing and any processing outside India. Review it against the DPDP Act 2023 with legal: grievance contact, purposes, retention.
- [ ] **DATA-03** Set a retention policy for each data type and enforce it with jobs: chat, receipts (under finance and tax record-keeping rules), logs, AI prompts. Add a legal-hold switch.
- [ ] **DATA-04** Handle requests for access, export, correction and erasure through admin tools, with exceptions where the law requires keeping records.
- [ ] **DATA-05** Encryption everywhere:
  - TLS 1.2 or higher on every connection;
  - RDS, S3 and backups encrypted with KMS;
  - the app's local database encrypted (APP-04).
- [ ] **DATA-06** Write an incident-response plan, including CERT-In reporting (within 6 hours for reportable incidents) and DPDP breach notification. Rehearse it once before launch.
- [ ] **DATA-07** Review access every quarter (who is an admin or approver), using the identity audit log.

### OPS: Observability and operations

- [ ] **OPS-01** Crash and error reporting: Sentry for the app (JavaScript and native, with source maps uploaded by CI) and for the backend, with personal-data scrubbing on.
- [ ] **OPS-02** Metrics and dashboards:
  - request rate, latency and errors;
  - open live streams, queue depth and push success;
  - AI tokens and spend;
  - database and Redis health.
- [ ] **OPS-03** Alarms go to on-call through SNS (email or chat). They cover:
  - 5xx rate, p95 latency, queue age, and a non-empty dead-letter queue;
  - AI spend, certificate expiry, and backup failure.
- [ ] **OPS-04** Every 5 minutes, on staging and production, a synthetic check signs in as a test account, sends a message and reads it back.
- [ ] **OPS-05** Service targets (SLOs):

  | Measure | Target |
  |---|---|
  | API availability | 99.9% |
  | API p95 latency (non-AI) | under 300 ms |
  | Message delivery p95 | under 2 s |
  | Crash-free users | 99.5% or more |
  | User-perceived ANR rate | under 0.47% (Play's bad-behaviour threshold) |
  | Crash rate | under 1.09% (Play's bad-behaviour threshold) |
  | Cold start on a mid-range phone | under 2 s |
- [ ] **OPS-06** Backups and disaster recovery:
  - RDS point-in-time restore for 35 days, plus daily snapshots copied to ap-south-2;
  - S3 versioning and replication;
  - RPO 15 minutes, RTO 4 hours;
  - a restore drill before launch and then every quarter.
- [ ] **OPS-07** Runbooks for:
  - deploying, and rolling back (app and API);
  - rotating a secret and restoring the database;
  - revoking a user or a lost phone;
  - incident response.
- [ ] **OPS-08** A config endpoint on the server: minimum app version, maintenance banner, and feature flags by role.
- [ ] **OPS-09** Cost controls:
  - AWS Budgets alerts, plus the AI budget (INT-02);
  - S3 lifecycle rules that move old files to cheaper storage;
  - limits on how long logs are kept.

### CI: Build, release and supply chain

- [ ] **CI-01** Two Android flavors:
  - `prod`: talks to the server, package `in.kirancable.kiranos`;
  - `demo`: standalone, dummy data, no secrets, with a `.demo` suffix so both can be installed side by side.
- [ ] **CI-02** Checks on every pull request:
  - app: typecheck, ESLint (new), Prettier, and Vitest with a coverage threshold;
  - backend: ruff, mypy, and pytest against a Postgres service container;
  - Android lint.
- [ ] **CI-03** Release builds:
  - `bundleRelease` produces the `.aab`, signed with the upload key from protected secrets;
  - the versionCode comes from the version tag and is always above 100 (the sideloaded v1.0 was 100);
  - tags are `android-vX.Y.Z`, with a changelog.
- [ ] **CI-04** Upload to Play's internal track through the Play Developer API.
  - Promote internal → closed (pilot) → production.
  - Use a staged rollout (10% → 50% → 100%), and halt it if crashes spike.
- [ ] **CI-05** Backend pipeline:
  - build the image, push it to ECR and scan it;
  - deploy to staging, running the migration task first, then a smoke test;
  - after manual approval, deploy to production (rolling or blue/green), rolling back automatically if health checks fail.
- [ ] **CI-06** Supply chain:
  - Dependabot or Renovate, CodeQL (TypeScript and Python), `npm audit` and `pip-audit`, and a Trivy image scan;
  - GitHub Actions pinned by commit SHA;
  - branch protection with required reviews, and CODEOWNERS.
- [ ] **CI-07** Scan build artifacts: MobSF static scan of the `.aab`, an OWASP ZAP baseline scan of the staging API, and the bundle secret scan (SEC-06).
- [ ] **CI-08** Infrastructure changes go through Terraform plan and apply in CI, with review.

### QA: Testing

- [ ] **QA-01** Keep the 242 unit tests and add coverage thresholds: 80% for `mobile/src/lib`, `mobile/src/api` and `mobile/src/native`, and 80% for backend routers and the claim workflow.
- [ ] **QA-02** Contract tests: shared chat-protocol fixtures run by both the TypeScript reducer and the Python validator.
- [ ] **QA-03** Authorization matrix tests (the AUTHZ "done when"), plus a regression test for self-approval.
- [ ] **QA-04** Backend integration tests in CI against Postgres, Redis and MinIO.
- [ ] **QA-05** End-to-end tests on emulators in CI with Maestro, replacing the DevTools-driven `.github/scripts/android-smoke.mjs`. The flow:
  - sign in (staging dev login), send a message, attach a photo;
  - file a claim, have HR approve it;
  - schedule a meeting (sandbox calendar);
  - tap a push and land in the chat.
- [ ] **QA-06** Test on real devices (Firebase Test Lab or AWS Device Farm):
  - a low-end Android 8/9 phone, a mid-range Android 12/13 phone, and a Pixel on Android 16;
  - Samsung, Xiaomi and Oppo/Vivo. Their battery savers kill background work, which is common on phones in India.
- [ ] **QA-07** Edge cases to cover:
  - Network: going offline in the middle of sending; a flaky connection; the server restarting mid-stream.
  - Session and time: the token expiring mid-session; clock skew; time zones.
  - Device and app: storage full; the app killed mid-upload; an app update while messages are still queued to send.
  - Accounts and concurrency: an account disabled while signed in; double-tap submits; two approvers acting at once.
  - Size: a 15 MB attachment; a room with 10,000 messages.
  - Settings: device language set to Hindi; maximum font size; dark mode; TalkBack.
- [ ] **QA-08** Load-test staging (k6 or Locust) with twice the expected number of staff online, live-stream fan-out, and a burst of receipts.
- [ ] **QA-09** Security:
  - a MobSF and MASVS review;
  - an external penetration test of the app, the API and `identity/` before launch;
  - every high and critical finding fixed.
- [ ] **QA-10** Check every screen for accessibility with Accessibility Scanner and a TalkBack walkthrough.
- [ ] **QA-11** Pilot acceptance testing on staging with dummy data, plus a bug bash with each department.

### DEMO: Dummy data (how we work until cutover)

- [ ] **DEMO-01** Build one consistent seed by merging the 14 chat users and the 12 finance employees into one directory with matching departments. Today they use different domains (`@kirancable.co.in` vs `@ulacorp.in`) and different departments (for example, Meera Nair).
- [ ] **DEMO-02** Put seed emails on a domain that can't receive mail (for example `@kirancable.test`), so nothing ever emails real people. Today, scheduling from the demo sends real invites to `@kirancable.co.in` addresses.
- [ ] **DEMO-03** One seed command loads everything into Postgres, with dates relative to today:
  - users, rooms and messages;
  - claims, payouts and budgets;
  - calendar, orders and dispatches.

  It also fixes the August 2026 dates in `master-frontend/vd/src/data/orders.ts` and the hard-coded SLA date in `master-frontend/vd/src/modules/rts/format.ts:5`.
- [ ] **DEMO-04** Staging `identity/` uses dev login, with one test account per role. Dev login is never enabled in production, and `identity/` already refuses it.
- [ ] **DEMO-05** Staging resets every night and on an admin-only button. The reset covers chat, claims and calendar together. Today they reset separately, and new claim numbers collide with claim cards already in chat.
- [ ] **DEMO-06** Google on staging uses a test Workspace user and calendar, with invites limited to test addresses.
- [ ] **DEMO-07** Generate `mobile/src/local/rts-seed.json` from the backend seed with a script. Today it is a manual copy, and `backend/tools/regenerate-seed.mjs` points at a file that no longer exists.
- [ ] **DEMO-08** Make a set of synthetic receipts for extraction tests: every category, duplicates, blurry photos, PDFs and foreign currency.

---

## 4. Roadmap

Timings assume 2–3 engineers, and the phases overlap.

| Phase | When | Items | Exit criteria |
|---|---|---|---|
| **0. Containment** | Days 1–3 | SEC-01…07 | No credential in anything downloadable; old keys revoked |
| **1. Foundations** | Weeks 1–3 | API-01, 04, 05, 07, 09–14; AUTHZ-03; DEMO-01…03, 07; Terraform for staging; CI-02, 05, 06 | Staging API on HTTPS in AWS with Postgres, logs, backups and CI tests |
| **2. Identity & permissions** | Weeks 3–6 | IAM-*; AUTHZ-*; API-02, 03, 08; DEMO-04…06 | Workspace sign-in works; the authorization matrix passes; no data reaches anyone who shouldn't see it |
| **3. App hardening & native** | Weeks 5–8 | APP-*; INT-11…14; OPS-01, 08; CI-01, 03, 04 | Release `.aab` on the internal track; MobSF clean; push works end to end |
| **4. Feature completion** | Weeks 7–12 | UX P1; INT-01…10, 15, 16; DEMO-08 | P1 table done; QA-05 end-to-end tests pass |
| **5. Launch readiness** | Weeks 11–14 | QA-06…10; OPS-02…07, 09; DATA-*; CI-07 | Pentest findings fixed; restore drill done; privacy notice approved |
| **6. Pilot & cutover** | Weeks 14–16+ | QA-11, then real data and production rollout (see the steps below) | Pilot signed off; rollout at 100%; 2 weeks of close support ("hypercare") |

Phase 6 in order:
1. Import the real directory from Workspace, the approver mapping and the budgets.
2. Roll out to production through Managed Google Play.
3. Anyone with the sideloaded v1.0 must uninstall it first, because it has a different signing key.

## 5. Production gate (all must be true before real data goes in)

- [ ] No secrets in the app bundle (CI scan) or the repo (gitleaks).
- [ ] Every endpoint rejects missing or invalid tokens, the authorization matrix passes, and pentest high/critical findings are fixed.
- [ ] The release `.aab` is built only by CI. It is not debuggable, R8 is on, and it is signed through Play App Signing.
- [ ] HTTPS only, and a backup restore has been drilled this quarter.
- [ ] Crash reporting, alarms and on-call are in place, and the SLO dashboards are live.
- [ ] The privacy notice is published, retention jobs are running, and the incident plan has been rehearsed.
- [ ] Rollback has been tested for the app (halt the rollout, previous build) and for the API (previous image).

## 6. Open questions (answer before the phase that needs each one)

| Question | Needed by |
|---|---|
| How many staff, and how many online at once? This sets sizing and QA-08 | Phase 1 |
| Are `kiranos.kirancable.co.in` and `auth.kirancable.co.in` the right domains? | Phase 1 |
| Do factory and field staff have Google Workspace accounts? If not, they can't sign in | Phase 2 |
| Which EMM: Google Workspace endpoint management, or another? | Phase 3 |
| Which languages beyond English and Hindi? | Phase 4 |
| Which AI provider under the data policy: OpenAI, or Bedrock in-region? | Phase 4 |
| Which ERP for orders and dispatches, and which bank for payouts? | Phase 4 / P2 |
| How long to keep chats and receipts, and are legal holds needed? | Phase 5 |

## 7. Risks

- **Riskiest assumption:** that every user has a Google Workspace account. If field staff don't, the sign-in design changes.
- **Domain-wide delegation** needs a Workspace super admin and a security sign-off. The fallback is per-user OAuth consent.
- **Android battery savers** (Samsung, Xiaomi, Oppo, Vivo) kill background connections, so all background delivery must go through FCM, not SSE.
- **WebView performance** in big rooms: virtualize lists early (APP-16).
- **Scope creep** towards consumer-chat parity: hold the P1 line.
