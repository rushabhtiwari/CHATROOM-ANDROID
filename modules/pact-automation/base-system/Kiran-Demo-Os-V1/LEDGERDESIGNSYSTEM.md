# The Ledger Design System

A portable extraction of the visual system used in the RTS app, written so it can be
dropped onto **any other site**. The chrome (navy sidebar, brand wordmark) is deliberately
excluded — this documents the **content area**: how a page opens, how numbers are set, how
surfaces are ruled, how status is stamped, and how buttons are colour-coded.

Stack assumed: **Tailwind CSS**. Everything here is either a Tailwind token, a
`@layer components` class, or a copy-paste JSX recipe. Nothing depends on a component
library.

---

## 1. The one idea

> **It is a ruled ledger, not a card dashboard.**

Every decision below follows from that. A stock SaaS dashboard floats rounded, shadowed,
pastel cards on a grey field. This system does the opposite: it *rules* the page with
lines, and depth comes from **contrast and line weight**, never from elevation.

Five non-negotiables. Break any one and the whole thing reads as a generic template again:

| Rule | Why |
|---|---|
| **`border-radius: 0` globally** (only `rounded-full` survives, for avatars/dots) | The hard edge is the identity. One rounded button destroys it. |
| **No `box-shadow` anywhere** | Depth = colour contrast + rule weight. |
| **Every number is monospace** (money, dates, IDs, counts, %) | Figures read as instrument readings, and columns align to the pixel. |
| **Colour is spent, never sprinkled** | A page gets one or two coloured marks. Everything else is ink, hairline, and paper. |
| **Related numbers are one ruled band, not N floating cards** | `gap-4` between stat cards is the single most template-looking thing you can do. |

### Tailwind config to enforce it

```js
// tailwind.config.js
export default {
  theme: {
    borderRadius: { none:'0', DEFAULT:'0', sm:'0', md:'0', lg:'0', xl:'0', '2xl':'0', '3xl':'0', full:'9999px' },
    boxShadow:    { none:'none', DEFAULT:'none', sm:'none', md:'none', lg:'none', xl:'none', '2xl':'none', inner:'none' },
    extend: { /* see §2–§4 */ },
  },
};
```

Overriding (not extending) `borderRadius` and `boxShadow` means the system is enforced by
the compiler. `rounded-lg` and `shadow-md` become no-ops — nobody can drift.

---

## 2. Colour

### 2.1 The structural palette — port this as-is

These are the greys that make the "drafting sheet" read. They are cooler and one stop
denser than Tailwind's defaults, which matters: a `slate-200` hairline disappears at 1px,
these don't.

```js
colors: {
  canvas:            '#E9EDF0',  // page ground — never white
  'canvas-deep':     '#DBE2E7',  // pressed / track / secondary ground
  hairline:          '#D2D9DF',  // the 1px rule. Used everywhere.
  'hairline-strong': '#A7B3BE',  // control borders, quiet icons, disabled figures
  meta:              '#5C6975',  // secondary text — 5.6:1 on white, safe for borders
  ink:               '#333333',  // body copy
  'ink-strong':      '#011627',  // headings, figures, the darkest thing on the page
}
```

**The single highest-leverage change** when porting to another site: set the page
background to `canvas` (`#E9EDF0`), not white. Surfaces are white *on top of* it. That
inversion is what makes ruled panels read as sheets of paper rather than as div soup.

### 2.2 The two brand slots — swap these for your brand

The whole system runs on exactly two brand colours plus the greys:

```js
colors: {
  accent:  '#E99741',  // ← your brand colour. Used for: active tab rule, hover row rule,
                       //   primary button fill, "current step", focus ring, empty-state tick.
  'accent-ink': '#011627', // ← text/icon colour that sits ON accent. MUST be ≥4.5:1.
  structure:   '#02223C',  // ← your dark neutral. Used for: the 3px page spine, card top
                           //   rules, table head rule, completed steps, secondary buttons.
}
```

> **The accent-contrast rule.** Mid-tone brand colours (orange, amber, lime, cyan) fail
> against white text. This system solves it by putting **dark ink on the accent**, never
> white. If your accent is dark (navy, maroon), flip `accent-ink` to white. Check it —
> this is the #1 accessibility failure when people copy a system like this.

### 2.3 Status tones — the ink/wash/rule triplet

Five tones. Each carries **three** values, and each value has exactly one job:

```js
colors: {
  'st-grey-ink':'#3F4A55',  'st-grey-bg':'#E4E8EC',  'st-grey-line':'#B4BEC7',
  'st-blue-ink':'#0B4A78',  'st-blue-bg':'#DCEAF5',  'st-blue-line':'#7FB0D4',
  'st-amber-ink':'#8A5A00', 'st-amber-bg':'#F8EBD3', 'st-amber-line':'#DFB463',
  'st-red-ink':'#A11020',   'st-red-bg':'#F7DDE0',   'st-red-line':'#E09AA3',
  'st-green-ink':'#0F5B3D', 'st-green-bg':'#DAEEE3', 'st-green-line':'#7FC0A2',
}
```

| Slot | Job | Never use it for |
|---|---|---|
| `-ink` | Stamp outline **and** stamp text. Left spine on a row. The 3px rule on a stat cell. | A fill behind white text. |
| `-bg` | A whole-row/whole-block **tint** for a callout that needs a ground. | A badge pill fill. |
| `-line` | Soft dividers inside a tinted block. | The border of anything interactive — it's ~2:1, it fails WCAG 1.4.11. |

Ship one file that maps tone → classes, and never hand-roll a status colour again:

```ts
export const TONE = {
  grey:  { stamp:'border-st-grey-ink text-st-grey-ink',   solid:'bg-st-grey-ink',   bg:'bg-st-grey-bg',   rule:'border-t-3 border-t-st-grey-ink' },
  blue:  { stamp:'border-st-blue-ink text-st-blue-ink',   solid:'bg-st-blue-ink',   bg:'bg-st-blue-bg',   rule:'border-t-3 border-t-st-blue-ink' },
  amber: { stamp:'border-st-amber-ink text-st-amber-ink', solid:'bg-st-amber-ink',  bg:'bg-st-amber-bg',  rule:'border-t-3 border-t-st-amber-ink' },
  red:   { stamp:'border-st-red-ink text-st-red-ink',     solid:'bg-st-red-ink',    bg:'bg-st-red-bg',    rule:'border-t-3 border-t-st-red-ink' },
  green: { stamp:'border-st-green-ink text-st-green-ink', solid:'bg-st-green-ink',  bg:'bg-st-green-bg',  rule:'border-t-3 border-t-st-green-ink' },
} as const;
```

---

## 3. Type

### 3.1 Two faces, three voices

```js
fontFamily: {
  sans:    ['Archivo', 'system-ui', 'Segoe UI', 'sans-serif'],       // body + UI
  display: ['Archivo', 'system-ui', 'sans-serif'],                    // same face, set WIDER
  mono:    ['IBM Plex Mono', 'ui-monospace', 'Consolas', 'monospace'], // every figure
},
```

The display voice is **not a second typeface** — it's the same grotesque set on its width
axis. Archivo has a real `wdth` axis, so headings get width instead of a new font. This is
the cheapest way to look art-directed rather than templated. Any variable grotesque with a
width axis works (Archivo, Roboto Flex, Inter Variable via `opsz`, Söhne).

```css
.ku-wide   { font-variation-settings: 'wdth' 112; } /* h1–h3, card titles, row titles */
.ku-xwide  { font-variation-settings: 'wdth' 125; } /* the wordmark / hero only */
.ku-narrow { font-variation-settings: 'wdth' 88;  } /* table column heads — width is scarce */
```

*No variable font available?* Substitute a condensed sibling for `.ku-narrow` and add
`letter-spacing: 0.01em` + `font-weight: 600` for `.ku-wide`. The effect survives.

### 3.2 The scale

```js
fontSize: {
  micro:       ['11px', { lineHeight:'14px', letterSpacing:'0.1em' }],  // stamped labels
  caption:     ['12px', { lineHeight:'16px' }],
  'body-s':    ['14px', { lineHeight:'20px' }],                          // the workhorse
  body:        ['16px', { lineHeight:'24px' }],
  lead:        ['18px', { lineHeight:'26px' }],
  h3:          ['20px', { lineHeight:'26px', letterSpacing:'-0.005em' }],
  h2:          ['28px', { lineHeight:'32px', letterSpacing:'-0.015em' }],
  h1:          ['38px', { lineHeight:'40px', letterSpacing:'-0.02em'  }],
  figure:      ['34px', { lineHeight:'36px', letterSpacing:'-0.04em' }], // stat anchor
  'figure-lg': ['46px', { lineHeight:'46px', letterSpacing:'-0.05em' }],
  display:     ['62px', { lineHeight:'58px', letterSpacing:'-0.05em' }],
},
letterSpacing: { stamp:'0.14em', eyebrow:'0.18em' },
borderWidth:   { 3:'3px', 6:'6px' },   // ← 3px is load-bearing in this system
```

Note the **negative tracking on every large step and positive tracking on every small
one**. Big type tightens, small caps type opens up. That contrast is a large part of why
the page reads as designed.

### 3.3 The instrument voice — the highest-impact rule here

Every money value, date, ID, count, percentage, and reference number is monospace with
tabular figures. Not "most". Every one.

```css
@layer components {
  .tnum   { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }

  /* Any figure, anywhere. */
  .ku-fig { @apply font-mono tabular-nums; font-feature-settings: 'tnum' 1, 'zero' 1; }

  /* The anchor figure on a page — a total. */
  .ku-total { @apply ku-fig font-semibold text-ink-strong; letter-spacing: -0.04em; }

  /* An identifier: REQ-2026-0103, an invoice no, a SKU. */
  .ku-docket { @apply font-mono text-caption font-medium uppercase text-meta; letter-spacing: 0.06em; }

  /* The stamped micro-label above a block. Never a sentence. */
  .ku-eyebrow { @apply font-mono text-micro font-semibold uppercase text-meta; }
}
```

**The counter-rule:** prose stays in the sans face even when it sits next to a figure. A
sub-label like *"46% of pool used"* is a sentence — set it in sans, and wrap only the
number in `.ku-fig`:

```jsx
<span className="text-meta">
  <span className="ku-fig">46%</span> of pool used
</span>
```

Mono for everything makes the page look like a terminal. Mono for figures only makes it
look like an instrument. That distinction is the whole trick.

**Gotcha (Tailwind specificity):** `.ku-total` lives in the components layer, which is
emitted *before* utilities. So `text-figure` (which carries its own `letterSpacing`) will
override `.ku-total`'s tracking. Restate it at the call site:

```jsx
<p className="ku-total text-figure tracking-tighter leading-none">₹40,000</p>
```

---

## 4. The component layer

Drop this whole block into your global CSS. It is the entire system in ~80 lines.

```css
@layer components {
  /* ---- Surfaces. Depth from contrast, never shadow. ---- */

  /* Ordinary flat panel. */
  .ku-card  { @apply border border-hairline bg-white; }

  /* The PRIMARY artifact on a page — 3px structure rule across the top.
     Use once per page, on the thing the page is actually about. */
  .ku-sheet { @apply border border-hairline border-t-3 border-t-structure bg-white; }

  /* A pulled-out note or quote. */
  .ku-rule-accent { @apply border-l-6 border-accent pl-4; }

  /* ---- The ledger band: N numbers = ONE ruled row, not N cards. ---- */
  .ku-ledger { @apply grid border border-hairline bg-white; }
  @media (min-width: 768px) { .ku-ledger > * + * { border-left-width: 1px; border-color: #D2D9DF; } }
  @media (max-width: 767px) { .ku-ledger > * + * { border-top-width: 1px;  border-color: #D2D9DF; } }

  /* Ruled rows — a hairline under every entry in a list. No zebra striping, ever. */
  .ku-ruled > * + * { @apply border-t border-hairline; }

  /* ---- The stamp: status as an office stamp, not a pastel pill. ---- */
  .ku-stamp {
    @apply inline-flex items-center gap-1.5 whitespace-nowrap border-2 bg-transparent px-2 py-0.5;
    @apply font-mono text-micro font-semibold uppercase;
    letter-spacing: 0.12em;
  }
  .ku-stamp-lg     { @apply gap-2 border-3 px-3 py-1.5 text-caption; letter-spacing: 0.14em; }
  .ku-stamp-struck {
    @apply inline-flex items-center justify-center border-3 px-5 py-2;
    @apply font-mono text-lead font-bold uppercase;
    letter-spacing: 0.18em; transform: rotate(-3deg);
  }

  /* ---- Signature marks. Each does real work; none is decoration. ---- */
  .ku-notch    { clip-path: polygon(0 0, calc(100% - 52px) 0, 100% 52px, 100% 100%, 0 100%); }
  .ku-notch-sm { clip-path: polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 0 100%); }
  .ku-dots     { background-image: radial-gradient(currentColor 1.5px, transparent 1.6px);
                 background-size: 24px 24px; }
  /* Diagonal hatch = the drawing-office mark for "void". Rejected/failed records only. */
  .ku-hatch    { background-image: repeating-linear-gradient(-45deg,
                   currentColor 0, currentColor 1px, transparent 1px, transparent 7px); }

  .ku-scrollbar { scrollbar-width: thin; scrollbar-color: #A7B3BE transparent; }
  .ku-scrollbar::-webkit-scrollbar       { height:10px; width:10px; }
  .ku-scrollbar::-webkit-scrollbar-thumb { background:#A7B3BE; }
  .ku-scrollbar::-webkit-scrollbar-track { background: transparent; }
}
```

And the base layer:

```css
@layer base {
  body { @apply bg-canvas font-sans text-body text-ink antialiased; }
  h1,h2,h3,h4,h5,h6 { @apply font-display text-ink-strong; font-variation-settings:'wdth' 112; }
  :focus-visible { outline: 2px solid theme(colors.accent); outline-offset: 2px; }
  ::selection    { background: theme(colors.accent); color: theme(colors.accent-ink); }
}
```

---

## 5. Recipes

### 5.1 Page header — "the spine"

The rhythm every page inherits, visible at the top of image 1: mono breadcrumb → wide
title → **3px structure rule across the full width** → standfirst below it.

```jsx
<header className="mb-8">
  <nav aria-label="Breadcrumb" className="mb-4">
    <ol className="ku-docket flex flex-wrap items-center gap-x-2">
      <li><a href="/" className="hover:text-accent-link">Home</a></li>
      <li aria-hidden className="text-hairline-strong">/</li>
      <li className="text-ink-strong" aria-current="page">Requests</li>
    </ol>
  </nav>

  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
    <h1 className="ku-wide max-w-3xl font-display text-h1 font-semibold text-ink-strong">
      My claims
    </h1>
    <div className="flex flex-wrap items-center gap-3">{actions}</div>
  </div>

  {/* The ledger spine — the rule the whole page hangs from. */}
  <div aria-hidden className="mt-4 h-[3px] origin-left animate-rule-in bg-structure" />

  <p className="mt-3 max-w-3xl text-body-s leading-6 text-meta">{subtitle}</p>
</header>
```

The action button sits **baseline-aligned with the h1** (`items-end`), then the rule runs
*under both*. That's what makes the header read as one ruled unit instead of a title with
a floating button.

### 5.2 The ledger band (stat row)

Four related numbers = one bordered box divided by hairlines. Each cell carries a **3px
tone rule on its top edge** — that rule is the *only* colour in the cell. No tinted icon
tiles, no coloured backgrounds, no chips.

```jsx
<div className="ku-ledger grid-cols-1 md:grid-cols-4">
  {stats.map(s => (
    <div key={s.label} className="relative flex min-w-0 flex-col px-4 py-4 sm:px-5">
      <span aria-hidden
            className={cx('absolute inset-x-0 top-0 origin-left animate-rule-in border-t-3',
                          s.tone === 'danger' ? 'border-st-red-ink' : 'border-structure')} />
      <p className="ku-eyebrow min-h-7">{s.label}</p>
      <p className="ku-total mt-1.5 text-h2 leading-none tracking-tighter xl:text-figure">
        {s.value}
      </p>
      <p className="mt-2 text-caption text-meta">{s.sub}</p>
    </div>
  ))}
</div>
```

Two details that carry it:

- `min-h-7` on the eyebrow reserves two lines, so every figure across the band lands on
  **one shared baseline** even when one label wraps.
- The figure **steps down** as columns get tighter (`text-h2` → `xl:text-figure`). A
  ten-character amount at 34px in a 4-up band will collide with the hairline otherwise.
- Give the whole band **one** tone. Spend a second colour only on the cell that is
  genuinely exceptional (in image 1, only "Still available" would go red).

Welding a chart directly under the band — note `border-t-0` so they share one rule:

```jsx
<div className="border border-t-0 border-hairline bg-white px-5 py-4">…</div>
```

### 5.3 Buttons — the colour coding you flagged in image 2

Every control is held by a **2px border**. That's the signature: it reads as a machine
control, not a web pill.

```js
const BASE =
  'inline-flex select-none items-center justify-center whitespace-nowrap border-2 font-sans ' +
  'font-semibold leading-none transition-all duration-150 active:translate-y-px ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0';

const SIZE = {
  sm: 'h-8  gap-1.5 px-3 text-body-s',
  md: 'h-10 gap-2   px-4 text-body-s',
  lg: 'h-12 gap-2.5 px-5 text-body',
};

const VARIANT = {
  // Accent fill with a DARK RIM around it. The rim is what makes it a control.
  primary:   'border-ink-strong bg-accent text-accent-ink hover:brightness-95 active:brightness-90',
  secondary: 'border-structure bg-structure text-white hover:bg-structure-600 active:bg-structure-700',
  outline:   'border-hairline-strong bg-white text-ink-strong hover:border-ink-strong hover:bg-canvas active:bg-canvas-deep',
  ghost:     'border-transparent bg-transparent text-ink-strong hover:bg-canvas-deep',
  danger:    'border-danger bg-danger text-white hover:brightness-95 active:brightness-90',
};
```

Three things worth stealing verbatim:

1. **The dark rim on the primary.** `border-ink-strong` around `bg-accent`. Without it the
   orange button floats; with it, it's a pressed key.
2. **Hover is `brightness-95`, not a new colour.** The palette never grows a "hover
   orange". Same for active at `brightness-90`.
3. **`active:translate-y-px`.** A 1px press. No shadow, so the physicality has to come
   from displacement.

**On `success`:** there is deliberately no green button. Green is a *status* ink (settled,
credited) — one hue cannot simultaneously mean "press this" and "this is done". The
forward action is always `primary`. In image 2, the row's ✓ / ✕ controls are icon buttons,
not green/red fills; the green and red live in the *stamps*.

Icon-only buttons take the same skeleton with a square footprint (`h-10 w-10`) and
**always** ship both `aria-label` and `title`.

### 5.4 Status stamps

A status is stamped, not pilled. Hard 2px outline, transparent ground, uppercase mono,
wide tracking. Outline and letters are the same ink — that's how a rubber stamp actually
prints, and it keeps the mark legible in greyscale, in print, and on tinted rows where a
wash would vanish.

```jsx
// Table / list stamp
<span className={cx('ku-stamp', TONE[tone].stamp)}>{label}</span>

// Heavier stamp, once at the head of a record
<span className={cx('ku-stamp ku-stamp-lg', TONE[tone].stamp)}>{label}</span>

// The struck stamp — angled, oversized. At most ONE per page, on a settled/void artifact.
<span className={cx('ku-stamp-struck animate-stamp-in', TONE.green.stamp)}>CREDITED</span>
```

Two neighbours from image 2:

```jsx
{/* A position on a pipeline is NOT a verdict — never give it a status colour.
    Neutral frame, accent rule down the leading edge = "you are here". */}
<span className="ku-stamp border-meta border-l-3 border-l-accent text-ink-strong">HR REVIEW</span>

{/* An SLA chip. The icon is what separates late from on-time, so colour is never alone. */}
<span className={cx('ku-stamp tnum', TONE.red.stamp, 'font-bold')}>
  <AlertTriangle size={12} aria-hidden /> OVERDUE BY 4D
</span>
```

The status dot is **off by default**. In a dense table the word already says "HR CLEARED";
a second colour-only marker on every row is noise. Turn it on only where a run of stamps
needs an at-a-glance colour anchor.

### 5.5 Table

```jsx
<div className="ku-scrollbar w-full overflow-x-auto bg-white
                max-h-[calc(100vh-16rem)] overflow-y-auto">
  <table className="w-full border-collapse text-body-s">
    <thead>
      <tr className="border-l-3 border-l-transparent">
        <th scope="col"
            className="ku-narrow sticky top-0 z-10 bg-white px-4 py-2.5 align-bottom
                       text-left text-micro font-semibold uppercase text-meta
                       after:absolute after:inset-x-0 after:bottom-0 after:h-0.5
                       after:bg-structure after:content-['']">
          Claim
        </th>
        {/* … */}
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-b-hairline last:border-b-0 border-l-3 border-l-transparent
                     bg-white transition-colors duration-150
                     hover:bg-canvas hover:border-l-accent">
        <td className="px-4 py-3 align-middle text-ink">…</td>
        <td className="ku-fig px-4 py-3 text-right align-middle text-ink-strong">₹26,800</td>
      </tr>
    </tbody>
  </table>
</div>
```

The specifics that make it:

- **A 2px structure rule under the whole head.** Not a grey `border-b`.
- **The ledger cursor.** Every row carries `border-l-3 border-l-transparent`; hover fills
  it with the accent. The line follows your pointer down the page like a finger on a
  ledger line. This replaces zebra striping entirely — **no zebra, ever.** Only a hairline
  under each entry.
- Column heads are `.ku-narrow` — condensed, because heads are cramped by definition —
  at `text-micro` uppercase in `meta`.
- Numeric columns are right-aligned **and** `.ku-fig`, so they stack on the comma.
- Row height ~44px (`px-4 py-3`), dense ~36px (`px-3 py-2`). This is a work tool.
- Sort carets are a quiet mono `↑ ↓ ↕` in `text-hairline-strong`, not an icon button.

**Sticky-header gotcha:** under `border-collapse: collapse` the head's bottom border
belongs to the table's border grid, not the cell — so it *scrolls away* from a sticky `th`
in Chromium. Draw it as an `::after` inside the cell instead (as above). The scroll parent
also needs a capped height, or `top: 0` resolves against a box that never moves.

### 5.6 Tabs

The active tab's 2px accent rule sits **on** the container's hairline via `-mb-px`, so the
two read as one continuous line. The count chip inverts on the active tab.

```jsx
<div role="tablist" className="flex overflow-x-auto border-b border-hairline">
  <button role="tab" aria-selected={active}
    className={cx('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-body',
                  'transition-colors duration-150',
                  active ? 'border-accent font-semibold text-ink-strong'
                         : 'border-transparent text-meta hover:text-ink-strong')}>
    All
    <span className={cx('tnum px-2 py-0.5 text-caption font-semibold',
                        active ? 'bg-accent text-accent-ink' : 'bg-canvas text-meta')}>3</span>
  </button>
</div>
```

### 5.7 List rows (image 1's claim ledger)

For entries richer than a table row. Each row gets a **1px-wide solid tone spine** down its
left margin, so the state is readable straight down the page.

```jsx
<ul className="ku-ruled">
  <li className="bg-white transition-colors duration-150 hover:bg-canvas">
    <a href={href} className="flex items-stretch">
      <span aria-hidden className={cx('w-1 shrink-0', TONE[tone].solid)} />

      <div className="flex flex-1 flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <span className="ku-docket">REQ-2026-0103</span>
            <span className="ku-wide font-display text-body font-semibold text-ink-strong">
              Vendor audit — Bengaluru
            </span>
            <span className="ku-stamp border-st-grey-ink text-st-grey-ink">Travel</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-s text-meta">
            <span>Filed <span className="ku-fig">24 Aug 2026</span></span>
            <span className="ku-fig">27 – 29 Aug 2026</span>
          </div>
        </div>

        <span className="ku-total shrink-0 text-h3 sm:w-36 sm:text-right">₹26,800</span>

        <span className="flex shrink-0 flex-col items-start gap-1.5 sm:w-[172px] sm:items-end">
          <StatusBadge /><StagePill />
        </span>

        <ChevronRight aria-hidden className="hidden h-4 w-4 shrink-0 text-hairline-strong sm:block" />
      </div>
    </a>

    {/* An inline action strip, when a row needs the reader to do something. */}
    <div className="flex flex-wrap items-center gap-3 border-t border-hairline
                    border-l-3 border-l-st-amber-ink bg-st-amber-bg px-4 py-2.5">
      <AlertTriangle className="h-4 w-4 shrink-0 text-st-amber-ink" aria-hidden />
      <p className="min-w-0 flex-1 text-body-s text-st-amber-ink">{note}</p>
      <Button variant="primary" size="sm">Answer the query</Button>
    </div>
  </li>
</ul>
```

**Fixed widths on the right-hand columns** (`sm:w-36`, `sm:w-[172px]`) are what make an
unruled list still scan as columns. Without them the amounts wander and it looks like a
feed.

### 5.8 Panel header

```jsx
<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4
                border-b border-hairline px-5 py-4">
  <div className="min-w-0">
    <p className="ku-eyebrow">Claim ledger</p>
    <h2 className="ku-wide mt-1.5 font-display text-h3 font-semibold text-ink-strong">
      Everything you have filed this month
    </h2>
  </div>

  {/* Summary figures as a <dl>, ranged right on the same baseline. */}
  <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
    <div>
      <dt className="ku-eyebrow">On view</dt>
      <dd className="ku-fig mt-0.5 text-body font-semibold text-ink-strong">3</dd>
    </div>
    {/* … */}
  </dl>
</div>
```

The eyebrow + wide title + right-ranged figure group is the standard panel opener. Use a
real `<dl>` — it's semantically right and it costs nothing.

### 5.9 Form controls

Fields carry a **heavier bottom rule** — the underline is the field, the box is just
containment.

```js
const CONTROL =
  'w-full min-w-0 border border-b-2 bg-white px-3 py-2 text-body text-ink-strong ' +
  'placeholder:text-meta transition-colors duration-150 ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-meta';

const RULE = 'border-hairline-strong border-b-meta hover:border-b-ink-strong ' +
             'focus:border-b-ink-strong disabled:border-b-hairline';

const RULE_INVALID = 'border-danger border-b-danger focus:border-b-danger';
```

- The bottom rule is `meta` (5.6:1), not `hairline-strong` (2.1:1) — a field boundary is
  non-text content and must clear 3:1 under WCAG 1.4.11.
- Focus **deepens the rule to near-black** rather than swapping in the accent. A mid-tone
  accent at ~2.3:1 would make the focused field *harder* to find than the resting one.
  The global 2px accent focus ring is what announces focus.
- Keep `CONTROL` and `RULE` as separate strings. Tailwind resolves conflicting
  border-colour utilities by stylesheet order, not by the order you wrote them.
- Labels are `.ku-eyebrow` in `text-ink-strong`.
- Inputs of type `number | tel | date | time | month | week` get `.ku-fig` automatically.

### 5.10 Empty state

An empty surface is an invitation, not an apology. Left-aligned, set like the head of a
blank ledger page. **A centred icon in a grey circle is the exact thing this system exists
to remove.**

```jsx
<div className="flex w-full flex-col items-start px-6 py-14 text-left">
  <span aria-hidden className="block h-0.5 w-7 bg-accent" />
  <div className="mt-3.5 flex items-center gap-2">
    <Inbox aria-hidden size={13} className="shrink-0 text-hairline-strong" />
    <span className="ku-eyebrow">Nothing on file</span>
  </div>
  <p className="ku-wide mt-2 font-display text-h3 font-semibold text-ink-strong">
    File your first claim
  </p>
  <p className="mt-2 max-w-[54ch] text-body-s leading-relaxed text-meta">{description}</p>
  <div className="mt-6"><Button variant="primary">File a claim</Button></div>
</div>
```

### 5.11 Stepper / pipeline

Not numbered bubbles — **one continuous rule divided into labelled segments**. The rule
carries the state, so the whole route reads from the line alone. Vertical on mobile,
horizontal from `md` up.

```js
const RULE = {
  complete: 'bg-structure',   // done
  current:  'bg-accent',      // you are here
  pending:  'bg-hairline',    // and thinner: w-px instead of w-[3px]
  rejected: 'bg-danger',
};
```

Each segment: a `00`-padded mono index, a state glyph (✓ / ✕ / accent square / nothing), an
eyebrow label, then a caption.

### 5.12 Progress bar

Zero radius, **1px gaps between segments** (`gap-px`), track in `canvas-deep`, segments
draw in from the left. The reading sits beside the bar in `.ku-fig`. The legend is a row of
`h-2.5 w-2.5` squares — squares, not dots.

```jsx
<div role="img" aria-label={summary}
     className="flex w-full gap-px overflow-hidden bg-canvas-deep" style={{ height: 10 }}>
  <div className="origin-left animate-rule-in bg-structure" style={{ width: '46%' }} />
  <div className="origin-left animate-rule-in bg-accent"    style={{ width: '15%' }} />
</div>
```

### 5.13 Timeline

Ruled like a ledger: a mono timestamp in a right-ranged left rail, a hairline spine, then
one actor and one action per entry in sentence case. **No bubbles, no avatars** — it's a
record of who did what, not a chat. A `1.5×1.5` square marker sits on the spine; the most
recent entry's marker is accent, the rest are structure.

Use a wrapping flex line (`w-24` rail + `basis-40` entry), not a fixed grid — the same
component has to survive a 750px drawer and a narrow sidebar rail.

### 5.14 Modal

`bg-ink-strong/60` scrim (no blur), square panel, `border-b border-hairline` header,
`bg-canvas` footer so the action bar separates from the body. Eyebrow → title → docket →
subtitle in the header; body scrolls with `.ku-scrollbar`; footer actions range right in
order `ghost → outline → primary`.

---

## 6. Layout & spacing

```js
spacing:  { 18:'4.5rem', 22:'5.5rem', section:'80px' },
maxWidth: { container:'1280px', shell:'1600px' },
```

The content well, with gutters that step up with the viewport:

```jsx
<main className="ku-scrollbar flex-1 overflow-y-auto">
  <div className="mx-auto w-full max-w-shell px-5 pb-16 pt-6
                  sm:px-7 lg:px-10 lg:pb-20 lg:pt-8 xl:px-14">
    {children}
  </div>
</main>
```

Bottom padding is deliberately larger than top (`pt-6` / `pb-16`) so the last row of a long
ledger never sits on the window edge.

**Vertical rhythm:** `mb-8` under the page header, `mt-8` between major sections,
`space-y-5` inside a form, `gap-3` between related controls. Related surfaces **weld**
(`border-t-0`) rather than sitting in a `gap`. When two things belong together, remove the
gap and share the rule — that is the structural move that most separates this from a card
dashboard.

---

## 7. Motion

Decisive, short, one easing curve: `cubic-bezier(0.22, 1, 0.36, 1)` — ease-out, no
overshoot.

```js
keyframes: {
  'page-in':  { '0%': { opacity:'0', transform:'translateY(8px)' }, '100%': { opacity:'1', transform:'none' } },
  'scale-in': { '0%': { opacity:'0', transform:'scale(0.97)' },     '100%': { opacity:'1', transform:'none' } },
  'rule-in':  { '0%': { transform:'scaleX(0)' },                    '100%': { transform:'scaleX(1)' } },
  'stamp-in': { '0%':  { opacity:'0', transform:'rotate(-9deg) scale(1.5)' },
                '55%': { opacity:'1', transform:'rotate(-3.5deg) scale(0.96)' },
                '100%':{ opacity:'1', transform:'rotate(-3deg) scale(1)' } },
},
animation: {
  'page-in':  'page-in 260ms cubic-bezier(0.22,1,0.36,1) both',
  'scale-in': 'scale-in 200ms cubic-bezier(0.22,1,0.36,1) both',
  'rule-in':  'rule-in 420ms cubic-bezier(0.22,1,0.36,1) both',   // pair with origin-left
  'stamp-in': 'stamp-in 340ms cubic-bezier(0.3,1.4,0.5,1) both',  // the one springy curve
},
```

**`rule-in` is the signature.** Every rule in the system — the page spine, the 3px cap on a
stat cell, each progress segment — draws in from the left like a pen across a ledger line.
Always pair it with `origin-left`. It costs two classes and it's most of the perceived
polish.

Staggered lists, index set inline:

```css
.ku-stagger > * { animation: page-in 300ms cubic-bezier(0.22,1,0.36,1) both;
                  animation-delay: calc(var(--stagger-step, 40ms) * var(--i, 0)); }
```
```jsx
<li style={{ '--i': index }}>…</li>
```

Transitions are `duration-150` on colour only. Nothing animates size or position on hover.

Honour reduced motion — but keep the stamp's angle, which is form, not motion:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
  .ku-stamp-struck { transform: rotate(-3deg) !important; }
}
```

---

## 8. Accessibility invariants

These are load-bearing, not polish. A hard-edged, low-chrome system fails fast if you skip
them.

1. **Never white on a mid-tone accent.** Dark ink on accent, always. Verify ≥4.5:1.
2. **A border that *is* the component must clear 3:1** (WCAG 1.4.11). Stamps are outlined
   in `-ink`, never `-line`. Field bottom rules are `meta`, never `hairline-strong`.
3. **Colour is never the only carrier.** Deltas ship a `↑`/`↓` glyph *and* an
   `sr-only` word. SLA chips ship a clock/warning icon. Statuses spell out the word.
4. **Visible focus everywhere:** `2px solid accent`, `outline-offset: 2px`, globally on
   `:focus-visible`.
5. **Don't make `<tr>` focusable.** Row click is a pointer convenience; the keyboard path
   is a real labelled control inside a cell.
6. **Icon-only buttons carry both `aria-label` and `title`.**
7. Ship a **skip link** — `sr-only focus:not-sr-only`, landing as an accent tab top-left.

---

## 9. Porting checklist

Working through these in order gets ~90% of the look on a new site:

- [ ] Override `borderRadius` and `boxShadow` to zero in `tailwind.config.js`.
- [ ] Page background → `canvas` (`#E9EDF0`). Surfaces are white on top of it.
- [ ] Add the structural greys (§2.1) verbatim; swap `accent` / `accent-ink` / `structure`
      for your brand (§2.2). Check `accent-ink` contrast.
- [ ] Add the five status-tone triplets and the tone→class map (§2.3).
- [ ] Load a variable grotesque + a mono. Add the type scale (§3.2).
- [ ] Paste the `@layer components` block (§4) and the base layer.
- [ ] Wrap **every** number on the site in `.ku-fig`. Leave prose in sans.
- [ ] Replace pill badges with `.ku-stamp`.
- [ ] Replace the stat-card grid with one `.ku-ledger` band.
- [ ] Give buttons a 2px border; primary gets the dark rim on accent.
- [ ] Delete zebra striping; add `border-l-3 border-l-transparent hover:border-l-accent`
      to rows.
- [ ] Add the 3px page spine under every page header.
- [ ] Add `origin-left animate-rule-in` to every rule and progress segment.
- [ ] Rewrite empty states left-aligned with an accent tick.
- [ ] Run the §8 accessibility list.

---

## 10. Reference: the whole system in ten lines

If you remember nothing else:

1. Zero radius. Zero shadow. Enforce it in the config.
2. The page is `canvas` grey; surfaces are white sheets ruled onto it.
3. Hairline `#D2D9DF` divides. 3px `structure` caps and anchors. 2px borders hold controls.
4. Every figure is mono + tabular. Prose stays sans.
5. Small labels are mono, uppercase, `0.18em` tracked. Big type has negative tracking.
6. Status is a stamped outline, never a pastel pill.
7. Related numbers are one ruled band, never N floating cards.
8. Colour is spent once or twice per page. The rest is ink, hairline, paper.
9. Rows have no zebra — a hairline under each, and an accent rule that follows the pointer.
10. Every rule draws in from the left.
