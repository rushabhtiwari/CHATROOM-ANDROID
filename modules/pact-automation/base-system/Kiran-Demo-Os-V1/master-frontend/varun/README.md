# KiranOS — Operations & AI Console

Frontend for **Kiran Cable Protection Products Private Limited**. React 18 + TypeScript +
Vite + Tailwind, fully mocked data (`src/data/*`) — no backend required.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # typecheck + production bundle into dist/
npm run preview
```

## Design system

Everything visual is driven from two files — change these, not the pages:

- `tailwind.config.js` — brand palette, neutral ramp, radii, elevation scale
- `src/index.css` — CSS variables, base typography, `.panel` primitives, motion

The palette is sampled directly from the company mark:

| Token | Hex | Use |
| --- | --- | --- |
| `brand` / `kiran` | `#06477F` | Wordmark navy — primary actions, links, active state |
| `ink` | `#0A2547` | Headings, sidebar ground |
| `strand-red` | `#B5070E` | Revenue rail, overdue / blocked |
| `strand-amber` | `#E9991B` | Operations rail, at-risk / pending |
| `strand-green` | `#018F3D` | Finance rail, on-track / approved |
| `strand-teal` | `#00AEEF` | Intelligence rail, informational |
| `ai` | `#5B46C8` | AI-generated content and confidence surfaces |

The four strand colours are the four fan blades of the logo, and they are used
consistently as department rails in the sidebar and as status semantics everywhere else.

Logo assets live in `public/`: `kiran-mark.png` (glyph), `kiran-lockup.png` (full lockup),
`favicon.png`.

## Structure

```
src/
  components/shell/    AppShell, Sidebar, TopBar, PageHeader, CommandPalette (⌘K)
  components/common/   DataGrid, StatusPill, Timeline, ApprovalBar, AIField, …
  pages/command/       Command Center
  pages/revenue/       Email intake → RFQ → Quotation → Sample → Order → Dispatch
  pages/operations/    Purchase (PR → RFQ → PO → GRN → 3-way match), Requisitions, Projects
  pages/finance/       Accounts, Bank reconciliation, Receivables, Payables, Reports & MIS
  pages/approvals/     Unified HOD approval inbox
  pages/intelligence/  Comms hub, Commitments, Escalations, Ask Kiran, AI control plane
  pages/system/        Automations, Integrations, Users, Escalation matrix, Audit, Settings
  data/                Mock fixtures — swap these for API calls when the backend lands
```
