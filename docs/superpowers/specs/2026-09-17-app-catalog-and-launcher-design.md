# App Catalog and Launcher Redesign — Design

**Date:** 2026-09-17
**Status:** Approved in brainstorming, pending written-spec review
**Builds on:** `2026-09-16-central-platform-sso-design.md` (identity service and portal, both implemented)

## 1. Goal

Make the central platform represent the company's real set of department modules and company-wide tools, and give the portal a minimal, clean, user-friendly look.

1. Register every department module and company-wide tool as an app, grouped as **Departments** or **Company tools**.
2. Let apps exist before they are built: they show as **Coming soon** to the people they are assigned to.
3. Show every app with an **icon**, or an uploaded **logo** when an admin adds one.
4. Replace the dashboard with a **launcher**: search first, large soft icons, two groups.
5. Bring the admin area into the same visual language.

Out of scope: building the modules themselves; per-module role design (each module will define its roles when built); SVG logos; object storage.

## 2. Decisions

| Topic | Decision |
|---|---|
| Catalog | 13 apps: 9 department apps, 4 company tools (§3.4) |
| Splitting combined rows | Sales / Dispatch, Accounts / Finance, HR / Production / Quality are separate apps; Purchase & Procurement stays one |
| Excluded | "Project setup & mobilisation" (a rollout service, not an app) |
| App groups | `department` or `company` |
| App status | `active` (shown as Live), `coming_soon`, `disabled` |
| Launcher style | Option C "Launcher" with the **soft** icon style (pale tinted square, coloured line icon) |
| Icons | Curated subset of the Lucide icon set, chosen per app |
| Logos | Uploaded per app; PNG, JPEG or WebP; max 256 KB; stored in the identity database; served to browsers through the portal |
| Default roles | Every seeded app gets `member` (rank 10) and `manager` (rank 30) |
| Default access | Each department gets its own app as `member`; every department gets all four company tools as `member` |

## 3. Identity service changes

### 3.1 Data model (migration `0002`)

Columns added to `apps`:

| Column | Type | Notes |
|---|---|---|
| `category` | `varchar(16)`, not null, default `'department'` | check `category IN ('department', 'company')` |
| `logo` | `bytea`, nullable | raw image bytes |
| `logo_content_type` | `varchar(32)`, nullable | `image/png`, `image/jpeg` or `image/webp` |
| `logo_updated_at` | `timestamptz`, nullable | changes on every upload or removal; used for cache busting |

Changed:

- `apps.status` check becomes `status IN ('active', 'coming_soon', 'disabled')`.
- `apps.icon` (existing text column) holds a Lucide icon name such as `truck`. Empty means the default icon.
- Constraint: a row with `logo` set must have `logo_content_type` set, and vice versa.

The existing `example` dev app and the `portal` system app keep `category = 'department'` and `status = 'active'`. The portal app is never shown in the launcher.

### 3.2 Status rules

| Status | Launcher (people with a role) | `/authorize`, `/token` | Admin |
|---|---|---|---|
| `active` | Tile opens `launch_url` | Allowed | Visible |
| `coming_soon` | Faded tile, not clickable, "Soon" label | Refused (same as an unknown client) | Visible |
| `disabled` | Hidden | Refused | Visible |

- Access resolution (`decide`) is unchanged for `active` and `coming_soon`. People are assigned to coming-soon apps exactly as to live ones, so access is ready on launch day. `disabled` still resolves to no access.
- `query_client` keeps returning only `active` apps, so coming-soon apps can't sign anyone in.
- Changing an app to `active` requires a non-empty `launch_url` and at least one redirect URI. Otherwise the API returns 422 with a message naming the missing field.
- Registering an app with status `coming_soon` accepts an empty `launch_url` and no redirect URIs.

### 3.3 API changes

`GET /me/apps` returns apps with status `active` or `coming_soon` where the user resolves to a role, excluding the portal:

```json
{
  "slug": "dispatch",
  "name": "Dispatch",
  "description": "Dispatch plans, POD and GRN follow-up",
  "category": "department",
  "status": "coming_soon",
  "icon": "truck",
  "logo_version": null,
  "launch_url": "",
  "role": "member"
}
```

`logo_version` is `logo_updated_at` as an integer epoch-seconds value, or `null` without a logo.

Admin app schemas gain `category`, `status` (three values), `icon` and `logo_version`. `AppIn.launch_url` and `AppIn.redirect_uris` become optional when `status` is `coming_soon`. `icon` must match `^[a-z0-9-]{0,40}$`; the portal decides how names map to drawings.

New endpoints:

| Method | Path | Auth | Behaviour |
|---|---|---|---|
| PUT | `/admin/apps/{id}/logo` | admin | Multipart field `file`. Detects the type from the file's leading bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF….WEBP`). Rejects other types and files over 256 KB with 422. Stores the bytes and sets `logo_updated_at`. Audits `app_logo_updated`. Returns the app. |
| DELETE | `/admin/apps/{id}/logo` | admin | Clears the logo fields. Audits `app_logo_removed`. 204. |
| GET | `/apps/{slug}/logo` | any active user (portal token) | Returns the bytes with the stored content type, `Cache-Control: private, max-age=86400`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src 'none'`. 404 when there is no logo or no such app. |

The declared multipart content type is ignored; only the detected type is trusted.

### 3.4 Catalog seed (migration `0002`)

The migration adds the catalog in every environment. It is idempotent by slug: departments or apps that already exist are left untouched, and grants are added only for apps this migration inserts.

Departments: `sales` Sales, `dispatch` Dispatch, `accounts` Accounts, `finance` Finance, `marketing` Marketing, `purchase` Purchase, `hr` HR, `production` Production, `quality` Quality.

Apps (all `status = 'coming_soon'`, `launch_url = ''`, no redirect URIs, unusable client secret hash `'!'`; an admin rotates the secret when the app goes live):

| Slug | Name | Category | Icon | Description | Department granted |
|---|---|---|---|---|---|
| `sales` | Sales | department | `trending-up` | Pending orders, invoices, customer MIS and credit checks | sales |
| `dispatch` | Dispatch | department | `truck` | Dispatch plans, POD and GRN follow-up | dispatch |
| `accounts` | Accounts | department | `book-open` | Bank reconciliation and vendor outstanding | accounts |
| `finance` | Finance | department | `landmark` | Receivables reports and UTR capture | finance |
| `marketing` | Marketing & RFQ | department | `megaphone` | Enquiries to RFQs, quotations and demand planning | marketing |
| `purchase` | Purchase & Procurement | department | `shopping-cart` | Purchase requests, vendor quotes, POs and GRN | purchase |
| `hr` | HR | department | `users` | Onboarding, leave, attendance and performance | hr |
| `production` | Production | department | `factory` | Production planning and tracking | production |
| `quality` | Quality | department | `badge-check` | Inspections and quality records | quality |
| `requisitions` | Requisitions & Budget | company | `clipboard-check` | Requisitions, approvals and monthly budgets | all nine |
| `projects` | Projects | company | `kanban` | Tasks, timelines, time tracking and costing | all nine |
| `automation` | Automation | company | `zap` | Your to-do list and escalations | all nine |
| `chat` | Chat | company | `message-circle` | Channels, messages and the AI assistant | all nine |

Each app gets roles `member` (Member, 10) and `manager` (Manager, 30). Every grant uses `member`.

The Production and Quality descriptions are placeholders until those modules are scoped. Admins can edit any description.

## 4. Portal changes

### 4.1 Visual language

Minimal and quiet. Colour appears only in the app icons.

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#FFFFFF` | page background |
| `--subtle` | `#F7F8FA` | admin sidebar, input fills |
| `--ink` | `#18202B` | primary text |
| `--muted` | `#6B7684` | secondary text |
| `--line` | `#E6E9ED` | dividers and borders |
| `--accent` | `#1D6B5F` | primary buttons, focus ring, current nav item |
| `--danger` | `#B42318` | destructive actions and errors |

- Type: Inter via `next/font`, 14 px base in admin and 15 px in the launcher, weights 400/500/600. Greeting 28 px, weight 600, letter-spacing −0.02em.
- Corners: 16 px on app icons, 10 px on inputs and buttons.
- No shadows except a 1 px line under the top bar.
- Soft icon palette: eight bg/fg pairs (teal, blue, amber, plum, green, rose, slate, indigo). Each app's pair is derived from its slug, so an app keeps its colour everywhere.

### 4.2 Launcher (home page)

```
┌──────────────────────────────────────────────────────────────┐
│ Central                                      Admin    (AA) ▾ │
├──────────────────────────────────────────────────────────────┤
│                    Good morning, Ada                         │
│              ┌──────────────────────────────┐                │
│              │ 🔍  Find an app               │                │
│              └──────────────────────────────┘                │
│  Departments                                                 │
│   [▢]    [▢]    [▢]    [▢]    [▢]    [▢]                     │
│  Sales Dispatch Accounts Finance Marketing Purchase          │
│   [▢]    [▢]    [▢]                                          │
│   HR  Production Quality                                     │
│  Company tools                                               │
│   [▢]    [▢]    [▢]     [▢]                                  │
│   Chat Projects Automation Requisitions                      │
└──────────────────────────────────────────────────────────────┘
```

- **Greeting:** "Good morning / afternoon / evening, {first name}", based on the browser's local time. It is rendered in a client component, so the server's time zone doesn't matter.
- **Search:** filters tiles by name and description as you type, case-insensitive. Empty groups hide. With no matches: "No apps match "{query}"." Pressing Enter opens the first live match. `/` focuses the search box.
- **Tiles:** a 64 px soft icon (or the logo, contained in the same square), with the app name below.
  - Live tiles are links opening `launch_url` in a new tab (`rel="noopener noreferrer"`).
  - Coming-soon tiles are not links. They show at 70% opacity, partly desaturated, with a "Soon" pill, and have `aria-disabled="true"`.
  - The description shows as a tooltip on hover and keyboard focus.
- **Groups:** "Departments" first, then "Company tools". Tiles are sorted by name within a group, and a group with no tiles isn't rendered.
- **Empty state:** "You don't have any apps yet. Ask an admin to add you to your department."
- **Responsive:** 6 columns on wide screens, 4 on tablets, 3 on phones.
- **Top bar:** "Central" on the left. On the right, "Admin" (admins only) and an avatar menu with the person's name and email and "Sign out".

### 4.3 Logos

- Tiles use `<img src="/logos/{slug}?v={logo_version}">` when `logo_version` is set. Otherwise they draw the Lucide icon (default `app-window`).
- `app/logos/[slug]/route.ts` fetches `GET /apps/{slug}/logo` with the signed-in user's token and passes the bytes and headers through. A missing logo returns 404.
- Admin logo upload is a server action that forwards the file to `PUT /admin/apps/{id}/logo`. The page shows a preview, "Upload logo", "Replace logo" and "Remove logo".

### 4.4 Admin area

The admin area keeps its current structure (People, Departments, Apps, Activity log) and adopts the new visual language:

- A sidebar on `--subtle`, with the current section marked in the accent colour.
- Pages have a title with a one-line description, content in sections separated by headings and lines, and tables with 44 px rows.
- **Apps list:** icon or logo, name, group, status (Live / Coming soon / Disabled) and client ID.
- **Register app:** name, short name, description, group, icon picker, status (default Coming soon), and address and callback URLs, which are required only when status is Live. Roles default to "member, Member, 10 / manager, Manager, 30".
- **App detail:** adds group, icon picker, status, and logo upload/replace/remove with a preview.
- **Icon picker:** a grid of the curated icons (§4.5) as radio buttons with visible names; the selected icon is outlined in the accent colour.

### 4.5 Curated icons

`trending-up, truck, book-open, landmark, megaphone, shopping-cart, users, factory, badge-check, clipboard-check, kanban, zap, message-circle, app-window, briefcase, building-2, calculator, calendar, chart-column, file-text, folder, headset, package, receipt, settings, shield-check, store, wallet, warehouse, wrench`

The portal imports exactly these components from `lucide-react` into one map. Unknown names render `app-window`.

## 5. Error handling

| Situation | Behaviour |
|---|---|
| Logo too large or wrong type | 422 "Logo must be a PNG, JPEG or WebP image up to 256 KB", shown inline under the upload control |
| Set Live without address or callback URLs | 422 "An app needs its address and at least one sign-in callback URL before it can go live" |
| Clicking a coming-soon tile | Nothing happens (not a link); the tooltip reads "{description}. Coming soon." |
| Logo fetch fails in the launcher | The tile falls back to the icon (`onError` hides the image) |
| Signing in to a coming-soon app directly | Same error page as an unknown client |

## 6. Testing

**Identity (pytest)**
- Migration `0002` seeds 13 apps, 9 departments, roles and grants. Running `alembic upgrade head` on a database that already has `sales` and `finance` departments leaves those rows alone.
- Status rules: coming-soon apps appear in `/me/apps` and are refused by `/authorize`. Disabled apps are hidden. Going live without an address or callback URLs returns 422.
- Logo upload: accepts PNG, JPEG and WebP (detected from bytes even when the declared type is wrong); rejects SVG, GIF, text and files over 256 KB; replace and remove work; each change is audited; `GET /apps/{slug}/logo` sends the security headers, returns 404 without a logo, and 401 without a token.

**Portal (Vitest)**
- Launcher filtering, grouping and sorting, Enter opens the first live match, empty and no-match states.
- Tile rendering: live link, coming-soon non-link with `aria-disabled`, logo vs icon, unknown icon fallback.
- Greeting by hour.

**Portal (Playwright)**
- A Sales member sees the Sales app and the four company tools, all marked Soon, and none are links.
- An admin uploads a logo, the launcher shows it, and removing it brings the icon back.
- An admin sets an app Live with an address, and the tile becomes a link.
- Search filters the tiles.
