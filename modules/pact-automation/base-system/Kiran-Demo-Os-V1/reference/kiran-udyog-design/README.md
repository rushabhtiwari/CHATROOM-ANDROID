# RTS — Receipt & Reimbursement Tracking System

A **structural, non-working demo frontend** for an internal receipt and reimbursement tracking
system. It routes travel and expense claims from an employee through HR, then Accounts, then a
Payment portal, and back into the employee's monthly allowance.

This is a **UI shell only**. There is no backend, no API, no auth, no database and no form
validation. Every screen renders from a static seed file so a stakeholder can click through the
whole flow in about three minutes.

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open the printed URL (default <http://localhost:5173>). The app redirects `/` to `/overview`.

```bash
npm run build
```

---

## The flow this models

1. Every employee has a **monthly allowance** (₹15,000 – ₹45,000 in the seed data) for travel and
   other expenses. The Admin Overview shows used / pending / remaining against it.
2. When the remaining balance runs low the employee raises a **request** and attaches a receipt.
3. The request reaches the **HR team**, which reviews business need → Approve / Reject / Request info.
4. On HR approval it reaches the **Accounts team**, which reviews financial feasibility — budget
   headroom, category policy caps, duplicate receipts → Approve / Send back / Reject.
5. On Accounts approval it enters the **Payment Portal**, which holds masked bank details and
   disburses single or batch payouts.
6. On disbursement the amount is **credited back to the allowance**, the Admin Overview updates, and the
   employee and HR are notified.

### Status state machine

```
DRAFT
  → SUBMITTED            (pending HR)
    → HR_INFO_REQUESTED  (back to employee)
    → HR_REJECTED        (terminal)
    → HR_APPROVED        (pending Accounts)
      → ACC_INFO_REQUESTED
      → ACC_REJECTED     (terminal)
      → ACC_APPROVED     (queued for payment)
        → PAYMENT_QUEUED
          → PAID
            → CREDITED   (terminal, success)
```

All eleven statuses, their labels and their badge colours are defined **once** in
[`src/lib/status.ts`](src/lib/status.ts) and imported everywhere. Nothing hard-codes a status colour.

| Tone | Statuses |
|---|---|
| Grey | `DRAFT` |
| Blue | `SUBMITTED`, `HR_APPROVED`, `PAYMENT_QUEUED` |
| Amber | `HR_INFO_REQUESTED`, `ACC_INFO_REQUESTED` |
| Red | `HR_REJECTED`, `ACC_REJECTED` |
| Green | `ACC_APPROVED`, `PAID`, `CREDITED` |

---

## Surfaces

| Route | Surface | Purpose |
|---|---|---|
| `/overview` | **Admin Overview** | Org-wide allowance, pipeline and utilisation across every team |
| `/my-requests` | **Requests** | The signed-in account's own claims — raise, attach, track |
| `/hr` | **HR Portal** | First-level approval queue |
| `/accounts` | **Accounts Portal** | Second-level financial approval |
| `/pay` | **Disbursement** | Checkout: pick a payee, release their approved claim |
| `/receipt/:utr` | **Payment receipt** | Standalone receipt — opens in its own tab, no app chrome |
| `/payments` | **Payout Ledger** | Bank records and the settled/failed payout history |
| `/requests/:id` | **Request detail** | The centrepiece — stepper, timeline, contextual actions |

### Navigation

The sidebar is grouped into labelled sections, so each team owns its own part of the system:

```
Admin Overview

MY WORKSPACE     My Requests
APPROVALS        HR Portal
                 Accounts Portal
                   └ Disbursement
                   └ Payout Ledger

MY WORKSPACE     Requests
```

The approval chain leads the rail — it is the work the system exists to do. Disbursement and the
ledger are **nested under Accounts Portal**, because they are the tail of the Accounts review rather
than a separate department. Approving a claim takes you straight to the checkout with that employee
preselected. The personal surface sits last and is scoped to whoever is signed in.

**HR and Accounts are deliberately separate sections** — they are different jobs run by different
teams, and the two screens are built to read differently. HR leads with counts, SLA chips and the
people in the queue. Accounts leads with money: value-based KPI tiles and a **Budget position** band
showing committed-against-allocation for every department, which HR has no equivalent of.

There is **no "view as" role switcher**. Every section is always reachable, and the request detail
action bar simply shows the buttons belonging to whichever team currently owns the step.

### The HR gate — enforced, not just implied

**Accounts cannot act on a claim until HR has explicitly approved it.** This is a hard rule in code,
not a visual hint:

- `isHrCleared(status)` in [`src/lib/status.ts`](src/lib/status.ts) is the single definition.
- In the Accounts queue, a claim in `DRAFT` / `SUBMITTED` / `HR_INFO_REQUESTED` / `HR_REJECTED`
  renders a **Locked** chip instead of Approve/Reject, with the reason on hover.
- The Accounts review drawer swaps its footer for a *"Locked — HR approval required"* banner.
- Bulk approve skips anything not HR-cleared rather than silently applying it.
- `isPayable(status)` (which implies HR clearance) gates the disbursement screen, so an
  un-approved claim can never reach a payee list.

### Disbursement

`/pay` is a payment-gateway-style checkout — payee list, order summary, transfer method, pay button,
success state — rendered in this app's own design language. It is **deliberately not a clone of any
real provider's branded page**, and it collects **no card, UPI or account credentials**; the only
bank data shown is the already-masked account on file. Nothing is actually transferred.

Each payee row groups that employee's Accounts-approved claims and shows the total owed, summed from
the amounts on the bills they uploaded, plus the bill count. Paying:

1. moves every claim in the payout `PAID` → `CREDITED`, writing both timeline events;
2. credits the amount back to the employee's monthly allowance;
3. settles the claim's existing queued payout in place (so the ledger never shows two live rows for
   one claim), or writes a new one with a generated UTR;
4. raises a **"Payment successful"** notification to that employee, whose balance change is visible
   on their Requests allowance card;
5. opens **`/receipt/:utr`** in a new tab.

### The receipt

Settling a payout lands on a dedicated receipt page following the familiar payment-receipt
composition: a coloured header band, the amount centred with a small `.00`, a green
**Paid Successfully** line, stacked Payment Id / Paid On / Method / UTR rows, a payee contact block,
the claims it settles, and a footer band with a support contact.

It is branded **Kiran Udyog**, not any real payment provider. A receipt carrying another company's
name, logo and domain is a forged document regardless of intent, so the layout is reproduced and the
identity is not. Radius stays at 0 and there are no shadows — design.md §5 applies here too.

**It renders in its own tab.** The route sits *outside* `AppShell`, so there is no sidebar or topbar
— just the receipt. Because a new tab boots a fresh app with fresh in-memory state, the receipt
cannot read the paying tab's context, so **the URL carries everything it needs**
(`?e=` employee, `?p=` payout id, `?m=` method, `?r=` claim ids, `?t=` timestamp). It falls back to
live context when opened in the same tab. No storage APIs are involved, and the link survives a
refresh and can be shared.

Every value is rendered from data — the receipt is generated, never a screenshot. A print
stylesheet strips the chrome so **Print receipt** produces a clean document rather than a capture of
the page.

If the browser blocks the pop-up, the checkout shows an "Open receipt" fallback link instead of
failing silently.

### Motion

Routes are **code-split** with `React.lazy`, which cut the main bundle from 720 KB to 226 KB
(201 KB → 72 KB gzipped) and removed Vite's chunk-size warning. That real loading is covered by:

- a 2px orange **route progress bar** that eases to 90% and completes when the page resolves;
- a **`PageLoader`** skeleton shaped like the page that is arriving, so nothing jumps on landing;
- a **page-in transition** (260ms, `cubic-bezier(0.22, 1, 0.36, 1)` — decisive, no overshoot) keyed
  on the pathname;
- **staggered entrances** for lists and KPI grids via `.ku-stagger`;
- press feedback on buttons and a `pop-in` on the receipt's success mark.

All of it is disabled under `prefers-reduced-motion`. design.md §8 asked for exactly this — the live
site has no interaction feedback at all, which it flags as reading "unfinished".

### Notifications

Notifications are **not a destination**. The topbar bell opens a **half-page popover** (50vh,
anchored under the bell) with Today / Earlier grouping, All / Unread tabs, per-row read state and
"Mark all read". Clicking a notification with a request attached navigates to that request.

---

## Design

The visual language is taken directly from [`design.md`](design.md), the Kiran Udyog design system
reference in this repo. Tokens are transcribed 1:1 into
[`tailwind.config.js`](tailwind.config.js) using the site's own colour names.

The three rules that define the look:

- **Zero border radius, globally.** Tailwind's radius scale is overridden to `0`; only
  `rounded-full` renders round (avatars, status dots, close buttons). `design.md` calls this "the
  single strongest signature".
- **No box shadows.** Tailwind's shadow scale is overridden to `none`. Depth comes from 1px hairline
  borders and colour contrast.
- **Orange is the only accent.** Status hues are the only other colours permitted.

Two signature devices from the source system carry over: the **notched corner** (`.ku-notch`, a
45° cut on the top-right, referencing a die-cut steel plate) and the **dot matrix** (`.ku-dots`)
used as a corner texture.

### Accessibility fixes applied from the design audit

`design.md` §10 lists twelve findings against the live site. Four are corrected here because they
are visual-system issues rather than content issues:

| Finding | Fix applied |
|---|---|
| #1 — white on orange buttons at **2.3:1** | Orange surfaces use `#011627` ink → **6.9:1**. There is no white-on-orange anywhere in this build. |
| #2 — orange links on white at **2.3:1** | Inline links use `--ku-link-on-light` `#B26516`. |
| #3 — `body` falling back to Times New Roman | A global `font-family: Inter, system-ui, sans-serif` is set on `body`; headings opt into Poppins. |
| #6 — no hover or focus states | A global 2px orange `:focus-visible` ring at 2px offset, and 150ms colour transitions on interactive elements. |

`prefers-reduced-motion` is honoured globally.

---

## Structure

```
src/
  main.tsx
  App.tsx                     router + app provider + 404
  context/AppContext.tsx      nav sections + shared request/payout/notification state
  data/mock.ts                ALL seed data — the single source of demo truth
  lib/
    types.ts                  domain types
    status.ts                 status → label + tone map, pipeline, action ownership
    format.ts                 currency, dates, relative time, masking
  components/
    layout/                   AppShell, Sidebar, Topbar, PageHeader, NotificationPanel,
                              RouteProgress
    ui/                       18 shared primitives (see below)
  pages/
    AdminOverview.tsx  MyRequests.tsx  HrPortal.tsx  AccountsPortal.tsx
    DisbursementCheckout.tsx  PaymentReceipt.tsx  PaymentPortal.tsx  RequestDetail.tsx
  (routes are lazy-loaded and code-split)
```

Components are presentational and prop-driven so real data can be dropped in later. Every point
where mock data is consumed carries a `// TODO: replace with API call` comment.

### Shared primitives

`Button` · `IconButton` · `Card` · `StatusBadge` · `Badge` · `StagePill` · `PayoutBadge` ·
`SlaChip` · `StatCard` · `DataTable` · `EmptyState` · `Skeleton` · `Drawer` · `Modal` · `Stepper` ·
`Timeline` · `FileDropzone` · `ReceiptGrid` · `ReceiptLightbox` · `Avatar` · `EmployeeChip` ·
`Tabs` · `Field` · `ProgressBar` · `AllowanceCard` · `FilterBar` · `DotMatrix`

One card style, one table style, one badge component, one empty state — reused everywhere.

### Formatting

All currency goes through `formatCurrency()`, which produces Indian digit grouping — `₹1,24,500`.
All dates go through `formatDate()` / `formatDateTime()` / `formatRelative()`. Numeric table columns
are right-aligned and use tabular figures via the `.tnum` utility.

---

## What is interactive

This is a demo shell, so the line matters:

**Genuinely functional (local React state only):**

- Tabs, filters and search on the HR, Accounts and Payments screens
- Approve / Reject / Request-info buttons — they flip a request's status, derive the new stage and
  append a timeline event, and the change is visible on every other screen
- Row selection and bulk approve / bulk disburse
- Drawers, modals, the receipt lightbox, the half-page notification popover
- Marking notifications read; the topbar bell count updates live
- Retrying a failed payout
- The full disbursement run: approve → checkout → pay → employee credited and notified
- **Reset payee queue** on the Disbursement screen, which restores every store to seed so the demo
  can be re-run without a refresh
- **Export PDF** on a request — generates a real, multi-page, text-selectable PDF (see below)
- **New Request** — Save Draft and Submit file an actual claim that appears in the list and, when
  submitted, lands in the HR queue with an SLA
- **Verify now** on an unverified bank record — flips the badge, updates the KPI, notifies the employee
- **browse / drag-and-drop** in the receipt dropzone — opens a real file picker

### PDF export

`Export PDF` on a request produces a genuine PDF via `jsPDF`, **drawn rather than screenshotted** —
every value is typed onto the page, so the output is selectable, searchable text at any zoom. It
carries the letterhead, a status chip, the amount panel, request details, justification, the receipt
manifest, the full approval trail with comments, and the payment block when one exists, with page
breaks and `Page n of m` footers.

`jsPDF` is imported dynamically, so its ~390 kB lands in its own chunk and only downloads when
someone actually exports. The main bundle is unaffected.

**Deliberately non-functional:**

- File upload — the dropzone is styled, and attached files are pre-seeded chips
- Export PDF, request bank verification
- The transfer itself — no money moves, and no payment credentials are ever collected
- The New Request form — inputs are controlled so typing works, but nothing validates or persists

**Nothing survives a refresh.** There is no `localStorage`, no `sessionStorage` and no network call
anywhere in the build.

---

## Assumptions

Everything below was not specified in `design.md` and was chosen for this build.

**Carried over from `design.md` with a deliberate change**

1. **Content max-width is 1440px, not 1280px.** `design.md` §5 specifies a `max-w-7xl` (1280px)
   container, but that is a marketing-site measure. The build prompt specifies ~1440px for an
   application shell, and dense data tables need the width. `max-w-container` (1280px) is still
   defined in the Tailwind theme if the narrower measure is wanted.
2. **Poppins is used for all display type; Inter 900 is not used.** `design.md` §10 finding #4 flags
   the two competing display voices on the live site. This build resolves it toward Poppins, since
   there are no full-bleed photographic hero banners in an admin console.
3. **The red `washed` token is reserved for destructive actions and failure states** rather than
   being a one-off card colour (§10 finding #9). It appears on reject buttons, failed payouts and
   duplicate warnings.
4. **The polaroid/tilt treatment and photographic hero bands are not used.** `design.md` explicitly
   scopes those to the About page of the marketing site and warns against letting them leak into
   product UI.

**Tokens added because `design.md` has no equivalent**

5. **Status hues.** `design.md` has no status system — it defines one accent and one alert red. The
   five status tones (`st-grey`, `st-blue`, `st-amber`, `st-red`, `st-green`) are new, each as an
   ink / tint / line triplet. Every ink-on-tint pair clears 4.5:1. Blue and green were chosen to sit
   beside the brand navy without competing with orange.
6. **Application greys.** `hairline #DCE1E6`, `hairline-strong #C3CBD3` and `canvas #F4F6F8` were
   added for borders and the page background. `design.md` uses only white and navy bands, which does
   not give a dense console enough separation without introducing shadows — which are forbidden.
7. **Navy tints** `navy-700 #083352` and `navy-600 #0E4368` for sidebar hover and active states.
   `design.md` §6.2 notes the live nav has no hover background at all and recommends adding feedback.

**Stack and product choices**

8. **Tailwind v3 with a JS config**, not v4, for a conventional and predictable setup.
9. **Recharts** for the two Overview charts; no chart library existed in the repo.
10. **lucide-react** for icons. `design.md` §7 specifies outlined line-art at ~2px stroke, which
    Lucide matches; icon sizes are reduced from the marketing site's 32px to 16–20px for console density.
11. **Fonts load from Google Fonts** via a `<link>` in `index.html`. This is the only external
    request in the app and it degrades to `system-ui` cleanly offline. No data ever leaves the page.
12. **A fixed demo "today" of 2026-08-31** (`DEMO_TODAY` in `src/lib/format.ts`) so relative dates,
    SLA chips and the overdue states stay stable rather than drifting as the seed data ages.
13. **Currency is INR only**, formatted with `en-IN` grouping. Multi-currency is out of scope.
14. **Account numbers are masked in the seed data itself**, not just at render time, and
    `maskAccount()` is applied again at every render point as defence in depth. No full account
    number exists anywhere in the codebase.
15. **`updateRequestStatus` writes a timeline event** and derives the next stage, so the audit trail
    stays coherent as a stakeholder clicks through. Real audit logging is out of scope.
16. **The demo persona (Rohan Deshmukh) deliberately starts in a low-balance state** — ₹4,500 of a
    ₹35,000 allowance. A low remaining balance is the trigger for the whole flow, so the warning is
    visible on first load rather than hidden behind a role switch. Farhan Qureshi is also seeded low
    so the state appears in the approver queues too.
17. **Timelines are generated from each request's status** by a builder in `mock.ts` rather than
    hand-written per request. This guarantees the vertical timeline, the stepper and the status
    badge can never disagree with one another.

---

## Out of scope

Authentication, real file upload, backend or API integration, form validation, permission
enforcement, exports, email/SMS delivery, audit logs, multi-currency and i18n are all deliberately
not built.
