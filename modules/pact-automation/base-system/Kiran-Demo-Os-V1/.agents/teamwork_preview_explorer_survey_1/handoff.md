# Handoff Report — Explorer Survey 1: Global Shell & Design Tokens

## 1. Observation

### 1.1 Stitch Design Tokens & Tailwind Configuration
Inspection of `master-frontend/varun/tailwind.config.js` reveals that the Stitch Precision Engineering Canvas tokens are defined under `theme.extend.colors` (lines 118–138):
```javascript
// tailwind.config.js:120-138
'surface-container-lowest': '#ffffff',
'surface-container-low': '#eff4ff',
'surface-container': '#e5eeff',
'surface-container-high': '#dce9ff',
'surface-container-highest': '#d3e4fe',
'on-surface': '#0b1c30',
'on-surface-variant': '#424750',
'outline': '#727781',
'outline-variant': '#c2c6d1',
'primary-container': '#06477f',
'on-primary': '#ffffff',
'on-primary-container': '#88b6f5',
'secondary-container': '#5bb8fe',
'on-secondary-container': '#00476e',
'tertiary-container': '#005136',
'tertiary-fixed': '#6ffbbe',
'tertiary-fixed-dim': '#4edea3',
'on-tertiary-fixed': '#002113',
```

Font families defined in `tailwind.config.js` (lines 139–143):
```javascript
fontFamily: {
  display: ['Archivo', 'sans-serif'],
  sans: ['"Inter Tight"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
  mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
},
```
Shadow elevations defined in `tailwind.config.js` (lines 154–163):
```javascript
boxShadow: {
  'hairline': '0 0 0 1px rgba(10, 37, 71, 0.06)',
  'xs': '0 1px 1px rgba(10, 37, 71, 0.05)',
  'card': '0 1px 2px rgba(10, 37, 71, 0.04), 0 1px 1px rgba(10, 37, 71, 0.03)',
  'raised': '0 1px 2px rgba(10, 37, 71, 0.05), 0 4px 12px -4px rgba(10, 37, 71, 0.10)',
  'popover': '0 8px 28px -6px rgba(10, 37, 71, 0.18), 0 2px 6px rgba(10, 37, 71, 0.06)',
  'modal': '0 24px 64px -12px rgba(10, 37, 71, 0.30), 0 8px 20px -8px rgba(10, 37, 71, 0.14)',
  'inset-line': 'inset 0 -1px 0 rgba(10, 37, 71, 0.06)',
},
```
In `src/index.css`:
- Lines 6–57: `:root` defines legacy CSS variables (`--ink`, `--slate`, `--muted`, `--line`, `--surface`, `--canvas`, etc.), but does **not** declare CSS variables for Stitch tokens (`--surface-container-*`, `--outline-variant`).
- Lines 59–61: `* { border-color: var(--line); }` binds default borders to `--line` (`#E4E9F0`).
- Lines 84–93: Tabular numbers and IBM Plex Mono typography are configured:
  ```css
  .font-mono, table td, table th { font-variant-numeric: tabular-nums; }
  .font-mono { font-family: 'IBM Plex Mono', monospace; letter-spacing: -0.02em; }
  ```
- Lines 109–133: Predefined component classes `.panel`, `.panel-header`, `.panel-lift`, and `.grid-head` use legacy variables (`@apply bg-surface border border-line rounded-lg shadow-card`) rather than Stitch tokens (`bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xs`).

In `index.html` (lines 10–14):
- Google Fonts preconnect and import for `Archivo:wght@500;600;700`, `IBM+Plex+Mono:wght@400;500;600`, and `Inter+Tight:wght@400;500;600;700`.
- Body element: `<body class="bg-canvas text-ink antialiased min-h-screen">`.

---

### 1.2 Reference Implementation (Project Management Module)
The reference implementation demonstrating precision engineering styling is located in `src/pages/projects/` and `src/components/projects/`:

1. **High-Density Data Row Height & Active Route / Selection Indicators**:
   - `src/components/projects/ListLayout.tsx` (lines 36–38):
     ```typescript
     const ROW_HEIGHT = 36;
     const HEADER_HEIGHT = 36;
     const QUICK_ADD_HEIGHT = 32;
     ```
   - Row styling in `ListLayout.tsx` (lines 265–271):
     ```tsx
     style={{ height: ROW_HEIGHT, paddingLeft: 16 + depth * 20 }}
     className={`group flex cursor-pointer items-center justify-between gap-2 border-b border-outline-variant/20 pr-3 transition-colors ${
       active
         ? 'bg-surface-container-low border-l-2 border-primary'
         : 'bg-surface-container-lowest hover:bg-surface-container-low/70'
     }`}
     ```
   - Monospace section headers in `ListLayout.tsx` (lines 192–215):
     ```tsx
     <div
       style={{ height: HEADER_HEIGHT }}
       className="group/header flex w-full items-center justify-between border-b border-outline-variant/30 bg-surface-container-low px-4 hover:bg-surface-container transition-colors select-none"
     >
       <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant font-mono">
         {group.label}
       </span>
       <span className="font-mono text-[11px] text-outline bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant/30">
         {group.items.length}
       </span>
     </div>
     ```

2. **Standardized 4-Across KPI Cards & Metric Presentation**:
   - `src/pages/projects/CycleDetailPage.tsx` (lines 132–228):
     - Grid definition:
       ```tsx
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 px-6 py-4 bg-surface-container-low/40">
       ```
     - Individual KPI Card:
       ```tsx
       <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30 shadow-xs flex flex-col justify-between">
         <div className="flex items-center justify-between text-xs">
           <span className="font-semibold uppercase tracking-wider text-outline text-[11px] font-mono">
             Total Workload
           </span>
           <CheckCircle2 className="h-4 w-4 text-outline" />
         </div>
         <div className="mt-2 flex items-baseline gap-2">
           <span className="text-2xl font-bold text-on-surface leading-none">{totalItems}</span>
           <span className="text-xs text-on-surface-variant">items</span>
           <span className="font-mono text-xs text-outline ml-auto">{totalPts} pts</span>
         </div>
         <div className="mt-2.5 pt-2 flex items-center justify-between text-[11px] border-t border-outline-variant/15 text-outline">
           <span className="text-primary font-medium">100% In Scope</span>
           <span className="font-mono">{uniqueAssignees} assignees</span>
         </div>
       </div>
       ```
     - Linear completion bar (line 117):
       ```tsx
       <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden flex">
       ```

3. **Operational Health Pills**:
   - `src/pages/projects/ProjectsGrid.tsx` (lines 252–267):
     - On Track: `inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800` with pulsing dot `<span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />`.
     - At Risk: `inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800` with pulsing dot `<span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />`.
     - Stale / Critical: `inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-strand-red`.

4. **Drawer Slide-Over & Attribute Sidebar Architecture**:
   - `src/components/projects/WorkItemPeek.tsx` (lines 48–53):
     ```tsx
     <aside
       role="dialog"
       className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[720px] flex-col border-l border-outline-variant/30 bg-surface-container-lowest shadow-2xl md:w-[720px]"
     >
       <header className="flex h-12 shrink-0 items-center justify-between border-b border-outline-variant/30 bg-surface-container-lowest px-4">
     ```
   - Attribute sidebar in `src/components/projects/WorkItemDetail.tsx` (lines 279–283):
     ```tsx
     <aside className="w-64 shrink-0 overflow-y-auto border-l border-outline-variant/30 bg-surface-container-low/40 p-4 text-xs select-none">
       <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-outline font-mono">
         Attributes
       </h3>
     ```
   - Hairline attribute field rows in `WorkItemDetail.tsx` (lines 35–40):
     ```tsx
     const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
       <div className="flex items-center justify-between py-1.5 border-b border-outline-variant/15 text-xs">
         <span className="w-20 shrink-0 text-[11.5px] font-medium text-outline">{label}</span>
         <div className="min-w-0 flex-1 flex justify-end">{children}</div>
       </div>
     );
     ```

5. **Sticky Control Bar & Filter Strips**:
   - `src/pages/projects/ProjectsGrid.tsx` (lines 81–195):
     - Sticky bar: `sticky top-0 z-20 border-b border-outline-variant/30 bg-surface-container-lowest px-6 py-3 shadow-xs`
     - Segmented tabs: `flex items-center rounded-lg border border-outline-variant/30 bg-surface-container-low p-0.5 text-xs`
     - Search input: `h-7 w-48 rounded-lg border border-outline-variant/40 bg-surface-container-low pl-8 pr-8 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:bg-surface-container-lowest focus:outline-none` with monospace kbd `/`
     - Quick filter strip: `mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/20 pt-2 text-xs`

---

### 1.3 Global Shell Components Audit

1. **`AppShell.tsx` (`src/components/shell/AppShell.tsx`)**:
   - Lines 40–49:
     ```tsx
     <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink antialiased">
       <Sidebar />
       <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
         <TopBar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
     ```
   - Lines 19–33, 50–60:
     - `FULL_BLEED = ['/chat']`, `FULL_BLEED_CHILDREN = ['/projects']`.
     - Non-full-bleed container: `<div className="max-w-[1680px] mx-auto px-8 py-7 animate-page-enter">`.
     - Discrepancies: Outer shell uses legacy `bg-canvas` (`#F4F7FB`) rather than Stitch canvas tokens (`bg-surface-container-low/30` or `bg-surface-container-lowest`). The fixed `px-8 py-7` padding prevents sticky control bars from reaching edge-to-edge as they do in `/projects`.

2. **`TopBar.tsx` (`src/components/shell/TopBar.tsx`)**:
   - Header container (line 46):
     `h-16 bg-surface/85 backdrop-blur-xl border-b border-line px-6 flex items-center justify-between gap-4 select-none sticky top-0 z-20`
     - Discrepancy: Uses `bg-surface/85` and `border-line` (`#E4E9F0`).
   - Breadcrumb navigation (lines 48–79):
     - Uses `text-muted`, `text-ink font-medium/semibold`, and `ChevronRight` in `text-slate-300`.
     - Discrepancy: Does not use Stitch `text-outline`, `text-outline-variant`, or monospace route keys.
   - Command palette trigger (lines 83–95):
     - Uses `bg-canvas hover:bg-white border border-line hover:border-kiran/30 rounded-md px-3 py-2 text-xs text-muted`.
     - Monospace kbd: `bg-white border border-line text-muted`.
   - Right controls (lines 98–184):
     - Live state badge: `bg-canvas border border-line`.
     - User switcher trigger: `border-l border-line`.

3. **`Sidebar.tsx` (`src/components/shell/Sidebar.tsx`)**:
   - Container (lines 216–224):
     - Dark navy gradient: `linear-gradient(168deg, #0A2547 0%, #072F58 55%, #04305A 100%)`.
     - Hairline divider: `absolute inset-y-0 right-0 w-px bg-white/10`.
     - Widths: `w-[68px]` (collapsed) vs `w-[252px]` (expanded).
   - Section headers (lines 280–282):
     - `text-[9.5px] font-semibold tracking-[0.14em] text-white/35 uppercase`.
   - Active route indicator (lines 310–318, 388–404):
     - Accent bar: `absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full` using group strand color or gradient.
     - Row background: `bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]`.
   - Badges (lines 415–424):
     - Monospace count: `font-mono text-[9.5px] font-semibold leading-none px-1.5 py-[3px] rounded-badge text-white`.

4. **`PageHeader.tsx` (`src/components/shell/PageHeader.tsx`)**:
   - Container (lines 21–50):
     - Simple vertical stack: `space-y-4 mb-6`.
     - Title: `font-display font-semibold text-[26px] leading-[1.15] text-ink tracking-[-0.025em]`.
     - Description: `text-[13px] text-muted mt-1.5 max-w-3xl leading-relaxed`.
     - Discrepancy: Lacks standardized hairline bottom divider (`border-b border-outline-variant/30 pb-4`), monospace section category eyebrow (`font-mono text-[11px] uppercase tracking-wider text-outline`), and integrated toolbar slot.

5. **`CommandPalette.tsx` (`src/components/shell/CommandPalette.tsx`)**:
   - Lines 190–277:
     - Outer dialog: `bg-surface rounded-xl shadow-modal border border-line`.
     - Search header: `border-b border-line bg-surface-2`.
     - Selection state: `bg-kiran-tint text-kiran` vs `hover:bg-canvas text-slate`.
     - Footer: `bg-canvas border-t border-line text-muted`.

6. **`DataGrid.tsx` (`src/components/common/DataGrid.tsx`)**:
   - Line 286: Table header `bg-surface-2/95 backdrop-blur-sm text-muted text-[10px] font-semibold uppercase tracking-[0.09em] border-b border-line`.
   - Line 364: Row height `${isCompact ? 'h-9' : 'h-11'}` where `h-9` is 36px, but default is 44px (`h-11`).
   - Line 362: Selection `bg-kiran-tint` rather than `bg-surface-container-low border-l-2 border-primary`.

---

## 2. Logic Chain

1. **Token Availability vs Usage Gap**:
   - *Observation 1.1* shows that Stitch tokens (`surface-container-lowest`, `surface-container-low`, `surface-container`, `surface-container-high`, `outline`, `outline-variant`, `on-surface`, `on-surface-variant`) are already configured in `tailwind.config.js`.
   - However, *Observation 1.1* and *1.3* reveal that non-project components (`AppShell`, `TopBar`, `PageHeader`, `DataGrid`, `CommandPalette`) are still using legacy Tailwind classes (`bg-canvas`, `bg-surface`, `bg-surface-2`, `border-line`, `border-line-2`, `text-ink`, `text-muted`).
   - *Deduction*: The design tokens are fully configured and functional at the Tailwind engine level; they simply need to be systematically applied across the global shell and operational modules.

2. **Reference Design Standards from Projects Module**:
   - *Observation 1.2* demonstrates that the project management module (`ProjectsGrid`, `ListLayout`, `CycleDetailPage`, `WorkItemPeek`, `WorkItemDetail`) represents a mature, working reference implementation of the "Precision Engineering Industrial Console" design language.
   - Specifically:
     a. **Hairline Dividers**: Standardized at `border-outline-variant/30` for structural container boundaries, `border-outline-variant/20` for list items, and `border-outline-variant/15` for inner field dividers.
     b. **Surface Hierarchy**: Base canvas as `bg-surface-container-low/30` or `bg-surface-container-low/40`, cards as `bg-surface-container-lowest` with `shadow-xs border border-outline-variant/30 rounded-xl`, secondary trays/rails as `bg-surface-container-low`, and pill tags as `bg-surface-container`.
     c. **Monospace Section Markers**: Eyebrow labels use `font-mono text-[11px] font-semibold uppercase tracking-wider text-outline`.
     d. **Fixed Row Height**: `ROW_HEIGHT = 36` (36px) is enforced in `ListLayout.tsx`. In `DataGrid.tsx`, `h-9` (36px) already exists as the compact variant.
     e. **Active Indicators**: Active items use `bg-surface-container-low border-l-2 border-primary`.
     f. **Operational Health Status**: Three-tier indicator pills with animated pulse dots (`emerald` for On Track, `amber` for At Risk, `red` for Overdue/Stale).
   - *Deduction*: Implementing the prompt requirements requires propagating these exact patterns from `src/components/projects/` and `src/pages/projects/` to the global shell and non-project consoles.

3. **Global Shell Modernization Strategy**:
   - `TopBar`: Update header to `bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/30 text-on-surface`. Update breadcrumbs to use `text-outline`, `text-outline-variant/50` separators, and `text-on-surface font-semibold` active route indicator. Update search button to `bg-surface-container-low border border-outline-variant/30 hover:border-primary/40 text-on-surface-variant`.
   - `Sidebar`: Maintain dark brand navy gradient (essential for Kiran brand lockup identity), but refine section headers with `font-mono tracking-widest text-[9px] uppercase text-white/40`, hairline boundary to `border-r border-outline-variant/30` (or `bg-white/10`), and crisp active route indicator pill accents.
   - `PageHeader`: Standardize with an optional monospace eyebrow (`font-mono text-[11px] uppercase tracking-wider text-outline`), hairline bottom border (`border-b border-outline-variant/30 pb-4 mb-6`), title in `text-on-surface`, description in `text-on-surface-variant`, and integrated action slot.
   - `AppShell`: Refine background to `bg-surface-container-low/30 text-on-surface` and evaluate route container paddings to ensure consistent alignment with high-density workspaces.
   - `DataGrid`: Set default row height to `h-9` (36px fixed standard), table thead to `bg-surface-container-low border-b border-outline-variant/30 text-outline font-mono uppercase tracking-wider text-[10px]`, and rows to `border-b border-outline-variant/20 hover:bg-surface-container-low/70` with active selection in `bg-surface-container-low border-l-2 border-primary`.

---

## 3. Caveats

1. **Brand Identity Preservation**:
   - `Sidebar.tsx` currently uses a custom brand gradient (`linear-gradient(168deg, #0A2547 0%, #072F58 55%, #04305A 100%)`) with multi-color strand accents (`#B5070E`, `#E9991B`, `#018F3D`, `#00AEEF`). Replacing this with a flat light container would destroy the Kiran Cable Protection brand wordmark aesthetic. The dark rail should be preserved, with typography and borders sharpened to precision industrial styling.

2. **Full-Bleed vs Centered Route Containers**:
   - In `AppShell.tsx`, `/chat` and `/projects/*` use full-bleed containers because they manage internal virtualized scrolling, sticky toolbars, and right-hand slide-over panels (`WorkItemPeek`).
   - If other modules (such as Invoices, Dispatch, or RFQ tables) are refactored to use sticky control bars or drawer sidebars, their routes must be evaluated for full-bleed vs centered container layout without breaking page scroll behavior.

3. **Radix & Chat Module Token Aliases**:
   - `tailwind.config.js` lines 67–73 and `src/index.css` lines 29–36 contain aliases for the chat module (`--rail`, `--chat-canvas`, `--bubble-mine`, etc.). Any modifications to Tailwind colors or CSS variables must not alter these mappings to prevent visual regressions in the conversation surface.

---

## 4. Conclusion

The Kiran OS frontend already has the complete Stitch Precision Engineering Canvas token palette defined in `tailwind.config.js`, and possesses an authoritative reference implementation in `src/pages/projects` and `src/components/projects`. 

The transition to a unified Precision Engineering Industrial Console requires four concrete alignments in the global shell and design token layer:
1. **Design Token Elevation**: Expose Stitch tokens as first-class CSS variables in `src/index.css` and update global component primitives (`.panel`, `.grid-head`) to consume `surface-container-*` and `outline-variant` tokens.
2. **TopBar & Breadcrumb Alignment**: Transition `TopBar.tsx` from `bg-surface/85 border-line` to `bg-surface-container-lowest/90 border-outline-variant/30`, modernize the breadcrumbs with crisp monospace separators/typography, and upgrade the search trigger and status pills.
3. **Sidebar Precision Styling**: Refine `Sidebar.tsx` section titles with monospace tracking, hairline border dividers, and high-precision route indicators while maintaining the signature Kiran brand navy gradient.
4. **Standardized PageHeader & DataGrid Primitives**: Elevate `PageHeader.tsx` to include monospace section eyebrows and hairline bottom dividers, and adjust `DataGrid.tsx` to standardize on 36px (`h-9`) row heights, uppercase monospace table headers, and Stitch surface container hover/active states.

---

## 5. Verification Method

### 5.1 Verification Commands
Execute in `master-frontend/varun`:
```bash
# 1. Typecheck verification
npm run typecheck
# Expected output: zero errors (exit code 0)

# 2. Production build verification
npm run build
# Expected output: Vite build succeeds cleanly with zero bundling errors
```

### 5.2 Files to Inspect
1. `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun\tailwind.config.js`
   - Verify `surface-container-lowest`, `surface-container-low`, `surface-container`, `outline`, `outline-variant` definitions.
2. `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun\src\index.css`
   - Inspect `:root` variables, font definitions, and `.panel` utility classes.
3. `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun\src\components\shell\TopBar.tsx`
   - Inspect breadcrumb styling, search bar trigger, and header container classes.
4. `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun\src\components\shell\Sidebar.tsx`
   - Inspect navigation group headers, active indicators, and border definitions.
5. `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun\src\components\shell\PageHeader.tsx`
   - Inspect structure, heading typography, and divider boundaries.
6. `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun\src\components\projects\ListLayout.tsx`
   - Confirm reference 36px row height (`ROW_HEIGHT = 36`) and `border-outline-variant/30` / `border-outline-variant/20`.
7. `c:\Users\hp\OneDrive\Desktop\kiran-payment-working-main\master-frontend\varun\src\pages\projects\CycleDetailPage.tsx`
   - Confirm reference 4-across KPI grid (`grid-cols-4 gap-3.5 bg-surface-container-low/40`) and card styling (`bg-surface-container-lowest border border-outline-variant/30 shadow-xs`).

### 5.3 Invalidation Conditions
- Any changes breaking existing mock stores (`useProjects`, `useChat`, `useRts`), TypeScript interfaces, or router configurations (`App.tsx`).
- Any degradation causing `npm run typecheck` or `npm run build` to fail.
