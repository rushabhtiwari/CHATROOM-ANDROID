# Brief 01 — Bring the analytics + quality-of-life bits from `kiran-udyog-design` into KiranOS

**For:** Claude Code
**Repo:** `C:\Users\hp\OneDrive\Desktop\kiran-payment-working-main`
**Reference (read-only):** `reference\kiran-udyog-design\` inside this repo

**Scope:** demo quality. Cherry-pick the good bits. Not a full redesign, not a
rewrite of existing pages.

---

## The one thing to know before you start

The two repos use different Tailwind vocabularies. The design repo sets
`borderRadius: 0` and `boxShadow: none` at the **theme root**, which deletes
Tailwind's defaults. If you merge its config into KiranOS, every rounded corner
and shadow in the chat module, dialogs and cards disappears.

**We do not care that ported pages look different from the rest of the console.**
So take the cheap route: scope the design repo's look to a wrapper class instead
of translating every className.

### Setup (one commit, do this first)

1. In `tailwind.config.js`, under `theme.extend` only, add:
   - the design repo's colours: `rich-black`, `darkey-bluey`, `orangy`,
     `lighty-orangey`, `meta`, `hairline`, `hairline-strong`, `navy-*`,
     and the `st-*-{ink,bg,line}` status triads. Copy the hex values verbatim.
   - the design repo's `fontSize` scale: `micro caption body-s body lead h3 h2 h1
     figure figure-lg display`. Copy the size/line-height/tracking triples verbatim.
   - its `letterSpacing`, `borderWidth: {3, 6}` and the `keyframes`/`animation`
     entries it uses (`fade-rise`, `page-in`, `scale-in`, `stamp-in`, `rule-in`,
     `shimmer`).
   - **Do not touch `borderRadius` or `boxShadow`.** Leave KiranOS's alone.
2. In `src/index.css`, add a `.ledger` scope:
   ```css
   .ledger, .ledger * { border-radius: 0; box-shadow: none; }
   .ledger { background: #E9EDF0; font-family: Archivo, system-ui, sans-serif; }
   ```
   Then paste in the `ku-*` utility classes from `reference/kiran-udyog-design/src/index.css`
   (`ku-fig`, `ku-docket`, `ku-eyebrow`, `ku-total`, `ku-stamp`, `ku-ruled`,
   `ku-wide`) unchanged.
3. Make sure Archivo and IBM Plex Mono are actually loaded — check
   `index.html` in both repos and copy the font links across if missing.

Any page wrapped in `<div className="ledger">…</div>` now renders in the design
repo's look, and nothing outside it changes. Verify: existing pages must look
byte-identical after this commit.

---

## What to port

Copy these from `reference/kiran-udyog-design/src/` into KiranOS under
`src/components/ledger/` — **as-is**, only fixing import paths:

- `components/ui/StatCard.tsx` (with `LedgerBand`)
- `components/ui/ProgressBar.tsx` (with `AllowanceCard`) — the segmented
  used / in-flight / uncommitted bar is the good bit
- `components/ui/Skeleton.tsx` (with `SkeletonCard`)
- `components/ui/StatusBadge.tsx` (with `Badge`, `StagePill`)
- `components/ui/DataTable.tsx`
- `components/ui/EmptyState.tsx`, `Avatar.tsx`, `Stepper.tsx`, `Timeline.tsx`
- `lib/format.ts` and `lib/status.ts` — the formatters and status maps the pages
  depend on

Keeping these in their own folder means no naming collisions with
`src/components/common/` and no decisions to make. Duplication is fine here; this
is a demo.

## The analytics page

Port `reference/kiran-udyog-design/src/pages/AdminOverview.tsx` to
`src/pages/reimbursements/ReimbursementsOverview.tsx`. Wrap the whole return in
`<div className="ledger">`. Route it at `/reimbursements/overview` and add it to
`src/components/shell/Sidebar.tsx`.

**Data: it is already there.** `backend/app/store.py::_analytics()` already
computes `monthlySpend`, `departmentUtilisation`, `policyCaps` and
`categorySpend`, and `AppState` already sends them under `analytics` in the
`/api/state` envelope that `src/modules/rts/store.tsx` subscribes to.

So delete the design repo version's `useEffect` / `api.getCategorySpend()` /
`loading` / `reload` machinery and read straight from the rts store. **Write no
backend code for this.** Field names match — both sides are camelCase on the wire.

You will need a small adapter: the design repo's `useApp()` returns
`{ employees, requests, payouts, currentEmployee }`. Write
`src/components/ledger/useLedgerData.ts` that maps the rts store into that exact
shape, so the ported pages need no edits beyond swapping the import.

`recharts ^2.15.1` is already installed. Add no dependencies.

## Optional, only if time allows

Same pattern — copy into `src/pages/reimbursements/`, wrap in `.ledger`, swap the
data hook. In value order:

1. `HrPortal.tsx` → richer HR queue than the current `HrReview.tsx`
2. `MyRequests.tsx` → richer claim list than `ReimbursementsList.tsx`
3. `DisbursementCheckout.tsx` → the checkout stepper

Route these as *additional* pages rather than replacing the existing ones, so
nothing that works today breaks. Decide later which to keep.

Skip `AccountsPortal.tsx` and `PaymentPortal.tsx` for now.

## Rules

- Never import from `reference/kiran-udyog-design` at runtime — copy files in.
- No new npm dependencies.
- `npm run typecheck` and `npm run build` clean at every commit.
- If a ported page fights the port for more than an hour, stop and leave it out.
  This is quality-of-life, not a milestone.
