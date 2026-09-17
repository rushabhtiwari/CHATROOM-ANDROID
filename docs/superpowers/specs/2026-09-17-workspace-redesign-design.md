# Workspace Redesign — Design

**Date:** 2026-09-17
**Status:** Approved in brainstorming (mockups: "Refined Bright workspace, Top navigation" and "Admin area in the same style"), pending written-spec review
**Replaces:** the visual language and page layouts in `2026-09-17-app-catalog-and-launcher-design.md` §4.1–4.4. Everything else in that spec (catalog, statuses, logos, access rules) stays.

## 1. Goal

Give the portal a professional, enterprise-grade look: a structured top-navigation workspace with rich duotone app icons, summary cards, a filter toolbar and consistent app cards on the home page, and an admin area built from the same headers, table cards and form cards.

Out of scope (considered and dropped): notifications bell, "Notify me" on coming-soon apps, favourites, list view, help page, dark mode.

## 2. Decisions

| Topic | Decision |
|---|---|
| Direction | "Bright workspace" with top navigation |
| Typeface | Plus Jakarta Sans (via `next/font/google`), weights 400–800 |
| Icons | Phosphor (`@phosphor-icons/react`): duotone weight for app icons and section accents, regular weight for interface glyphs. Replaces `lucide-react`. |
| App icon tile | Glossy squircle: per-app two-stop gradient, top highlight, soft coloured shadow, white duotone glyph |
| Stored icon names | Unchanged (the 30 names in the catalog spec §4.5); the portal maps each to a Phosphor icon, so no data migration |
| Admin navigation | Section tabs under the top bar (People, Departments, Apps, Activity log) instead of a sidebar |
| Registering an app | Its own page (`/admin/apps/new`) instead of a form under the list |
| Identity API change | `GET /admin/apps` items gain `departments: [{slug, name}]` (departments with access) |

## 3. Visual system

### 3.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F5F7FB` | page background |
| `--surface` | `#FFFFFF` | top bar, cards, tables |
| `--surface-2` | `#F8FAFC` | table header, card footers |
| `--line` | `#E5EAF1` | card and table borders |
| `--line-strong` | `#DCE2EA` | inputs, secondary buttons |
| `--text` | `#0F172A` | primary text |
| `--text-2` | `#475569` | body copy in cards |
| `--muted` | `#64748B` | secondary text |
| `--faint` | `#94A3B8` | counts, placeholders |
| `--primary` | `#1D4ED8` | primary buttons, links, active tab |
| `--primary-soft` | `#EFF4FF` | active tab background, selected icon |
| `--success` / `--success-soft` | `#047857` / `#ECFDF5` | Live |
| `--danger` / `--danger-soft` | `#B42318` / `#FEF2F2` | Disabled, destructive actions, errors |
| `--warning` / `--warning-soft` | `#C2410C` / `#FFF7ED` | Coming soon accent in summary cards |

Radii: 10 px controls, 14 px cards and tables, 13 px app icons (18 px at 64 px). Card shadow: `0 1px 2px rgba(15,23,42,.04)`. Primary button shadow: `0 1px 2px rgba(29,78,216,.3)`.

Type scale: 26 px / 800 page greeting; 24 px / 800 admin page titles; 15 px / 700 section and card titles; 14 px base; 12–13 px secondary. Letter-spacing −0.02em on headings.

### 3.2 App icon

- Sizes: 32 px (tables and small lists), 46 px (home cards), 64 px (app detail header and logo preview).
- Gradient pair per app from a palette of 14 pairs (green, blue, amber, violet, rose, teal, pink, slate, cyan, emerald, orange, yellow, indigo, grey), chosen by a stable hash of the slug.
- An uploaded logo replaces the gradient and glyph, sized to cover the tile on a white background. It falls back to the icon if the logo fails to load.
- Coming-soon apps: icon at 82% opacity and 55% saturation.

### 3.3 Components

| Component | Description |
|---|---|
| `TopBar` | Height 60 px. Brand mark and "Central"; divider; tabs Home and Admin (Admin only for admins); search field (§4.2); account button with avatar, name and role line ("Administrator", or the person's department names) opening a menu with email and Sign out. |
| `PageHeader` | Optional icon or breadcrumb, title, description, right-aligned actions. |
| `StatCard` | Tinted duotone icon, big number, label. |
| `Segmented` | Pill-group control with optional counts. Used for filters and for status and group fields. |
| `Switch` | Accessible toggle (`role="switch"`). |
| `AppCard` | Home page card (§4.3). |
| `TableCard` | White card with a toolbar row (filter input, filter selects, result count) and a table with a `--surface-2` header. |
| `Badge` | Dot plus label: Live (success), Coming soon (neutral), Disabled (danger), Suspended (danger), Admin (primary). |
| `FormCard` | Card with a title, a one-line description, a two-column field grid and a footer with actions. |
| `AdminTabs` | Section tabs with icons; the current section is underlined in `--primary`. |

## 4. Home page

### 4.1 Layout (width ≤ 1180 px, centred)

```
[TopBar: Central | Home  Admin |  Search apps…  ⌘K |  (AA) Ada Admin / Administrator ▾]

Wednesday, 17 September                                        [Manage apps]  (admins)
Good afternoon, Ada

[14 Apps you can open] [4 Live now] [10 Coming soon] [1 Your departments]

[All 14 | Departments 10 | Company tools 4]                        (o) Live only

Departments  10   Tools for each team's day-to-day work
[card][card][card][card]
Company tools  4   Shared by everyone across departments
[card][card][card][card]
```

- **Date and greeting:** rendered in the browser (local time); the server renders the date line empty and "Welcome, {first name}".
- **Summary cards:** counts come from `/me/apps` and `/me`. "Your departments" is the number of departments the person belongs to.
- **Filter tabs:** switch which groups show; counts reflect the search and "Live only".
- **"Live only":** hides coming-soon apps.
- **Sections:** show a count pill and a one-line description; empty sections are hidden. Apps are sorted by name.

### 4.2 Search

- The top-bar search is visible on every page. `/` or `⌘K` / `Ctrl+K` focuses it.
- On the home page it filters the cards as you type (name or description, case-insensitive). Enter opens the first live match in a new tab.
- On other pages, Enter navigates to `/?q={query}`, which opens the home page already filtered.
- No match: "No apps match "{query}"." with a "Clear search" button.

### 4.3 App card

- Structure: body (icon, name, group label, description clamped to two lines) and a footer with a fixed 44 px height.
- Footer for a live app: "Live" status, "· {Role label}", and an "Open ↗" button. The whole card is a link to `launch_url` (new tab) with the app name as its accessible name.
- Footer for a coming-soon app: "Coming soon" status only. The card is not a link and has `aria-disabled="true"`.
- The role label is the role key with its first letter capitalised (e.g. `manager` → Manager).
- Grid: 4 columns above 1200 px, 3 above 900 px, 2 above 560 px, 1 below.

### 4.4 Empty state

A person with no apps sees an empty-state card: a duotone illustration icon, "No apps yet", "Ask an admin to add you to your department.", and no toolbar.

## 5. Admin area

### 5.1 Shell

`TopBar` with the Admin tab active, then `AdminTabs`: People (`users`), Departments (`buildings`), Apps (`squares-four`), Activity log (`clock-counter-clockwise`). Content width ≤ 1180 px.

### 5.2 Apps list (`/admin/apps`)

- Page header: "Apps", description, primary button "Register app" linking to `/admin/apps/new`.
- `TableCard` toolbar: text filter (name, description, client ID), Group select (All / Departments / Company tools), Status select (All / Live / Coming soon / Disabled), and a count ("15 apps"). Filtering happens client-side.
- Columns: App (32 px icon, name, description), Group, Status badge, Client ID, Departments with access ("All 9 departments" when every department has access, otherwise comma-separated names, "None" when empty), and a chevron. The whole row links to the app.
- The built-in portal shows "Built in" as its description, "—" as its group, and "Everyone" for access.

### 5.3 Register app (`/admin/apps/new`)

- Page header with breadcrumb "Apps / Register app".
- **Details** card: name, short name (with its hint), description, group (segmented), icon picker, status (segmented, default Coming soon).
- **Connection** card: app address, sign-in callback URLs, sign-out return URLs, marked "Needed when the app is live".
- **Roles** card: textarea (defaults to Member and Manager) with its hint.
- One primary "Register app" button. On success the page shows the credentials panel (client ID and secret, copy-once warning) with a link to the new app.

### 5.4 App detail (`/admin/apps/{id}`)

- **Header:** 64 px icon, breadcrumb "Apps / {name}", title, client ID and status badge. "Create new secret" button (not for the portal) whose result shows the credentials panel.
- **Main column:**
  - **Settings** form card: name, status (segmented), description, group (segmented), icon picker grid (10 per row), and Cancel/Save changes.
  - **Connection** form card: address, callback URLs, sign-out URLs, "Save connection". Saving Live in Settings without a connection shows the identity service's go-live error inline.
  - **Roles** card: table plus the add-role form row.
- **Side column:**
  - **Logo** card: 64 px preview; drop zone "Upload a logo or drag it here · PNG, JPEG or WebP, up to 256 KB" backed by a real file input; "Remove logo" when a logo exists.
  - **Access** card: departments with access and their roles, and the role list.
- **Portal app:** Connection and Logo cards are read-only notes, and status and group are hidden.

### 5.5 People (`/admin/users`, `/admin/users/{id}`)

- **List:** `TableCard` with a server-side search input, department and status selects; columns Person (initials avatar, name, email), Departments, Status badge (plus Admin badge), Last sign-in; row links; Previous/Next pagination in the card footer.
- **Detail:**
  - Header: avatar, name, email, badges.
  - Main column: an **Access** table card (app icon, app, role, why), a **Departments** form card (checkbox chips, Save), and an **Exceptions** card (table plus the add-exception form).
  - Side column: an **Account** card with Suspend/Reactivate, Make admin/Remove admin, and Sign out everywhere, each with a one-line explanation.

### 5.6 Departments (`/admin/departments`)

- Page header with an "Add department" button that reveals an inline form card.
- Each department is a card: name, member count, and a table of apps (icon, name, role select), with "Save access". Rename and Delete sit in the card header's action menu (a `<details>` menu).

### 5.7 Activity log (`/admin/audit`)

`TableCard` with event, from and to filters; columns When, Event (monospace chip), By, Person, App (icon plus name), Details; "Older activity" in the footer.

## 6. Identity service change

`AppOut` (used by `GET /admin/apps`, `GET /admin/apps/{id}` and the other app endpoints) gains `departments: list[{slug: str, name: str}]`, sorted by name: the departments with a grant for the app. One query loads all grants for the listed apps, so the list stays a fixed number of queries regardless of app count.

## 7. Accessibility and quality floor

- Every interactive element is keyboard reachable with a visible focus ring (`2px solid --primary`, offset 2 px).
- Segmented controls are radio groups; the switch uses `role="switch"` with `aria-checked`; the account menu closes on Escape and on outside click.
- Colour is never the only signal: statuses always have text.
- Contrast of text on tinted backgrounds is at least 4.5:1.
- Layout works down to 390 px wide. The top bar collapses the search to an icon button that expands it, and tables scroll horizontally inside their cards.
- `prefers-reduced-motion` disables hover lifts and transitions.

## 8. Testing

**Identity (pytest)**
- `GET /admin/apps` returns `departments` with names sorted.
- The query count for the app list doesn't grow with the number of apps (checked with a SQLAlchemy event counter).

**Portal (Vitest)**
- Home filtering: tabs, Live only, search, counts, Enter opens the first live match, `?q=` prefill.
- `AppCard` live and coming-soon rendering; role label formatting.
- Icon map: every stored name maps to a Phosphor icon, and unknown names fall back.
- `AppsTable` client-side filters and the "All 9 departments" / "None" labels.
- `Segmented` and `Switch` keyboard behaviour; account menu.

**Portal (Playwright)**
- Existing specs updated for the new structure (admin tabs, the register-app page, cards).
- A new check that `⌘K` focuses search and that searching from an admin page opens the filtered home page.
