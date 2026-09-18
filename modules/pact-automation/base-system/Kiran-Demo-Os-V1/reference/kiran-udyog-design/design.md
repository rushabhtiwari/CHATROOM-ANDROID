# Kiran Udyog — Design System Reference

**Source:** https://www.kiranudyog.com/ (captured 2026-08-31, desktop 1440×900 and mobile 390×844)
**Scope:** Visual design only — colour, type, spacing, components, layout, motion. No functional/backend behaviour is documented here.
**Audience:** (a) client-facing walkthrough of the current design language, (b) internal build reference for rebuilding or extending these screens.

Screenshots referenced throughout live in [`screenshots/`](screenshots/).

---

## 1. Design summary in one paragraph

Kiran Udyog reads as a **heavy-industry manufacturer**: deep navy fields, hard 90° corners everywhere (zero border-radius is the single strongest signature), full-bleed photography of plant floors under dark overlays, and a warm safety-orange used sparingly as the only accent. Headings are a geometric grotesque (Poppins) set very large and often uppercase; body copy is Inter at a compact 16px. Layout is a simple stacked-section rhythm — an 80px vertical beat, a 1280px container, and alternating white / navy bands — with two recurring decorative devices: a **cut (notched) corner** on feature cards and a **6-column dot matrix** in section corners.

**Tone:** industrial, credentialed, factual. Not playful, not soft, not glassy.

---

## 2. Brand assets

| Asset | Notes |
|---|---|
| Wordmark | `KIRAN` in a light-weight extended sans, cyan/steel blue, with an orange "beam" mark integrated into the **A**. Trademark ® superscript. Always on white in the header; reversed treatment on dark not currently used. |
| Tagline (hero) | *Insulating Boundaries* |
| Tagline (footer) | *Where Quality Meets Tradition and Commitment* |
| Product naming | ALL-CAPS prefix + numeric code — `KIRASHIELD 1442`, `KIRANTEX 3310`, `KIRATEX 1102`, `KIRASRG 001 (FIRE)`. Treat as a typographic element: uppercase, semibold, tracking-normal. |

---

## 3. Colour

The live site is Tailwind-based with custom colour names. Those names are kept below so the spec maps 1:1 onto the existing codebase.

### 3.1 Core palette

| Token (site name) | Hex | RGB | Role |
|---|---|---|---|
| `rich-black` | `#011627` | 1, 22, 39 | Deepest surface — footer, page base, card text on light |
| `darkey-bluey` | `#02223C` | 2, 34, 60 | **Primary brand navy** — dark sections, nav bar, contact block, stat numerals |
| `orangy` | `#E99741` | 233, 151, 65 | **Accent** — primary buttons, links, eyebrows, active rules, dividers |
| `lighty-orangey` | `#E99741` @ 55% (≈ `#F4C696` on white) | — | Secondary/soft accent — "Learn More" buttons, stats band |
| `washed` | `#E71D36` | 231, 29, 54 | Alert red — used once, on the third feature card |
| `dark-white` | `#EBEBEB` | 235, 235, 235 | Off-white — hero headline, modal surface, body text on navy |
| `light-black` | `#333333` | 51, 51, 51 | Secondary body text on light |
| `white` | `#FFFFFF` | — | Primary light surface, card backgrounds |
| Neutral grey | `#6B7280` | — | Meta text (header phone/email values) |

### 3.2 Usage rules

- **Navy is the ground, white is the page.** Sections alternate `#FFFFFF` → `#02223C` → `#FFFFFF`. Never place two navy sections adjacent without a white band or a photo section between them.
- **Orange never becomes a surface at full width** except the stats band, where it is dropped to 55%. Full-strength orange is reserved for interactive elements and 8px accent rules.
- **Red (`washed`) is a one-off.** It appears only on the "Sustainable Innovation" card. If the card set grows, either commit to a repeating 3-colour cycle (orange → navy → red) or drop red entirely.
- **Photography is always darkened.** Hero and inner-page banners layer `black/20` plus a navy tint over the image so `#EBEBEB` type stays legible.

### 3.3 Contrast audit (WCAG 2.1)

| Pair | Ratio | Verdict |
|---|---|---|
| `#EBEBEB` on `#02223C` | 13.6 : 1 | Pass AAA |
| `#FFFFFF` on `#02223C` | 16.2 : 1 | Pass AAA |
| `#E99741` on `#02223C` | 6.9 : 1 | Pass AA (all sizes) |
| `#011627` on `#F4C696` (Learn More) | 11.7 : 1 | Pass AAA |
| `#FFFFFF` on `#E71D36` | 4.5 : 1 | Pass AA (normal text) — no margin |
| **`#FFFFFF` on `#E99741` (primary button)** | **2.3 : 1** | **Fails AA and AAA at every size** |
| **`#E99741` on `#FFFFFF` ("Click Here" link)** | **2.3 : 1** | **Fails — orange links on white are not readable** |

**Recommended fix, no palette change required:** set button and link text on orange to `#011627` instead of white — that lifts the primary button to **6.9 : 1** and keeps the brand colour intact. For orange text on white, use `#B26516` (a darker shade of the same hue) or set links in navy with an orange underline.

### 3.4 CSS custom properties

```css
:root {
  --ku-rich-black:   #011627;
  --ku-navy:         #02223C;
  --ku-orange:       #E99741;
  --ku-orange-soft:  rgba(233, 151, 65, 0.55);
  --ku-red:          #E71D36;
  --ku-off-white:    #EBEBEB;
  --ku-ink:          #333333;
  --ku-meta:         #6B7280;
  --ku-surface:      #FFFFFF;

  /* accessible pairings */
  --ku-on-orange:    #011627;   /* not white */
  --ku-link-on-light:#B26516;
}
```

### 3.5 Tailwind config (matches the live class names)

```js
// tailwind.config.js — theme.extend.colors
colors: {
  'rich-black':     '#011627',
  'darkey-bluey':   '#02223C',
  'orangy':         '#E99741',
  'lighty-orangey': 'rgba(233,151,65,0.55)',
  'washed':         '#E71D36',
  'dark-white':     '#EBEBEB',
  'light-black':    '#333333',
}
```

---

## 4. Typography

Two families, split cleanly by role.

| Role | Family | Weights in use |
|---|---|---|
| Display / section headings | **Poppins** | 600, 700 |
| UI, body, buttons, nav, forms | **Inter** | 300, 400, 600, 900 |

> The hero H1 and the newsletter-modal H1 are the exceptions — they use **Inter 900**, not Poppins. Either normalise these to Poppins 700 or codify "Inter 900 = full-bleed hero display" as a deliberate second display style. Right now it is inconsistent.

### 4.1 Type scale (as measured)

| Step | Size / line-height | Family · weight | Applied to |
|---|---|---|---|
| Display | 48 / 48 (1.0) | Poppins 700 | Section headings — "Why choose Kiran Udyog", "Amazing Products", "Our Strength in Numbers", "Our Clients" |
| Hero | 48 / 48 | Inter 900, uppercase | `INSULATING BOUNDARIES`, inner-page banner titles |
| H2 | 30 / 36 | Poppins 600 · Inter 700 | Card titles, "Kiran Udyog" eyebrow, modal heading |
| Lead | 18 / 28 | Poppins 400 / Inter 400 | Card subtitles, hero sub-copy |
| Body | 16 / 24 | Inter 400 | Default paragraph, nav items, labels, inputs |
| Body S | 14 / 20 | Inter 400 | Card body, header contact values |
| Caption | 12 / 16 | Inter 300 | Copyright line |
| Button | 16 / 24 | Inter 600 | All CTAs |
| Product name | 16 / 24 | Inter 600, uppercase | `KIRATEX 1102` etc. |

Letter-spacing is `normal` everywhere. No tracking adjustments are applied, including on the uppercase 48px hero — **adding ~0.02em to uppercase display type would noticeably improve it.**

### 4.2 Known typographic defect

`<body>` computes to **`Times New Roman`, 16px** — no global font-family is set; fonts are applied per component. Any text rendered outside a styled component (error states, injected markup, unstyled slots) will fall back to serif. **Fix:** set `font-family: Inter, system-ui, sans-serif` on `html`/`body` and let headings opt into Poppins.

---

## 5. Layout & spacing

| Property | Value |
|---|---|
| Content container | `max-w-7xl` = **1280px**, centred |
| Alternate container | 80% viewport width (`md:w-4/5`) on several sections |
| Narrow measure | `max-w-2xl` (672px) for centred intro paragraphs |
| Page gutter | 24px mobile (`mx-6`) → 40px small desktop (`px-10`) |
| Standard section padding | **80px** top and bottom (`py-20`) |
| Large section padding | 96px (`py-24`); 160px top on the clients section (`pt-40`) |
| Band padding | 32px vertical for the stats strip |
| Gap scale | 4px · 8px · 16px · 20px · 24px · 28px · 32px · 40px · 48px · 56px (`gap-1 … gap-14`) |
| Grid columns | 3-up feature cards; 4-up stats; 6-up decorative dot matrix; horizontal rail for products |
| **Border radius** | **0px globally.** Only exceptions: the modal close button and small dot marks (`rounded-full`) |
| Elevation | **No box-shadows anywhere.** Depth comes from colour contrast, not shadow. |

**Vertical rhythm:** every section is an 80px-padded block, full-bleed background, inner container centred. Backgrounds alternate light/dark; the section is the unit of design, not the card.

---

## 6. Component inventory

### 6.1 Utility header (white, ~106px)
Logo left. Right: two contact blocks, each an outlined line-art icon (phone, envelope, ~32px, 2px stroke) + a two-line stack — label `Inter 600 16px #011627`, value `Inter 400 14px #6B7280`. No background, no border.

### 6.2 Primary nav bar (navy, ~60px)
Full-bleed `#02223C`. Six items distributed across the container: Home · About Us · Products ⌄ · Quality · Careers · Contact Us. `Inter 400 16px #FFFFFF`. Active item: **2px white underline** with ~12px of breathing room below the label. "Products" carries a chevron for a dropdown. No hover background — hover should be an underline or an orange rule to stay in-language.

### 6.3 Hero — `screenshots/01-home-hero.png`
- Full-bleed photograph of an industrial plant, `background-attachment: fixed` (parallax on scroll), `background-size: cover`.
- Overlay: `black/20` plus a navy wash for legibility.
- Height ≈ 564px desktop.
- Content left-aligned inside the container:
  1. **Eyebrow** — `Kiran Udyog`, Inter 700 30px, `#E99741`, preceded by an **8px-wide solid orange vertical bar** (`border-l-8`).
  2. **H1** — two lines, uppercase, Inter 900 48px/48px, `#EBEBEB`.
  3. **Sub-copy** — Inter 400 16–18px, `#EBEBEB`, wrapped to ~3 lines / ~50ch.
  4. **CTA** — solid `#E99741`, white label Inter 600 16px, padding `16px 32px`, radius 0.

### 6.4 Notched feature card — `screenshots/02-home-feature-cards.png`
The strongest custom component. Three equal cards, ~32px gutter.

- Solid fill: orange `#E99741` / navy `#02223C` / red `#E71D36`.
- **Top-right corner is cut away** at roughly 45°, ~50px, revealing the page behind it — a die-cut/steel-plate reference.
- Internal padding ≈ 32px.
- Content: **Title** Poppins 600 30px white → **Subtitle** Poppins 400 18px `#EBEBEB` → 24px gap → **Body** Inter 400 14px `#EBEBEB`.
- No radius, no shadow, no border.

```css
.ku-notch-card {
  clip-path: polygon(0 0, calc(100% - 52px) 0, 100% 52px, 100% 100%, 0 100%);
  padding: 32px;
  border-radius: 0;
}
```

### 6.5 Dark product section + horizontal rail — `screenshots/03-home-products-rail.png`
- Navy `#02223C` band, ~1068px tall, with a **dot-matrix motif** (6×4 grid of ~3px dots, ~24px pitch, low-opacity white) pinned to the top-right.
- Heading Poppins 700 48px white, then two body paragraphs at 16/24 `#EBEBEB` constrained to roughly 60% width.
- **Product cards** in a horizontally scrolling rail, ~250px wide, partial card visible at the right edge to signal scrollability:
  - White background, radius 0.
  - Product photo, ~140px tall, flush to the card's top and side edges.
  - Body block padded 16px: name (Inter 600 16px uppercase `#011627`) → description (Inter 400 14/20 `#333`, **clamped to ~5 lines with an ellipsis**).
  - Footer button: full-width, `lighty-orangey` fill, label `Learn More` Inter 600 16px `#011627`, padding `8px 16px`.
- Below the rail: `Looking for more products?` in white with **`Click Here`** in orange.

### 6.6 Stats band — `screenshots/04-home-stats-clients.png`
Full-container strip in soft orange (`lighty-orangey`), 32px vertical padding. Four cells split by **1px white vertical dividers** on desktop, stacked on mobile. Each cell: numeral Poppins/Inter ~48px 900 `#011627` + label Inter 400 16px. Values: `40+ Products · 250+ Satisfied Customers · 200+ Employees · 50+ Years of Manufacturing Experience`.

### 6.7 Clients strip
White section with the dot-matrix motif at the left. Centred heading + a centred 672px intro paragraph, then client logos in one row at their **native colours** (Alstom, GE, Motherson Sumi, Suzlon), ~56px gap, vertically centred. Logos are not normalised for size or treatment — see §10.

### 6.8 Contact split — `screenshots/05-home-contact-footer.png`
Navy `#02223C`, two columns divided by a 1px vertical rule.
- Left: `Contact Us` Poppins 700 48px white, one-line sub-copy, then phone and email rows (outlined 32px icon + label/value stack).
- Right: form — labels Inter 400 16px white above each field; inputs white, **radius 0, no border**, padding `8px 16px`, 16px text; two fields side by side (Name, Email) then a full-width message textarea; **Submit** is a full-width solid `#E99741` bar with white 600 label.

### 6.9 Footer
`rich-black #011627`, ~378px, 40px horizontal padding.
- Left: `Kiran Udyog` Inter 600 ~24px `#EBEBEB` + tagline 16px, then a 3-column link grid (Home/About Us/Quality, Products/Careers/Contact Us) at 16px with ~44px row gap.
- Right: `Stay Informed With Our Newsletter` + inline input (white, radius 0) with an attached solid-orange **Subscribe** button, then phone / email / LinkedIn rows using the same icon+stack pattern.
- Bottom bar: slightly lighter navy, 12px 300 copyright left, LinkedIn glyph right.

### 6.10 Newsletter modal — `screenshots/kiran-mobile.png`
Fires on page load. `#EBEBEB` panel, ~530px wide desktop, 32px padding, radius 0. Heading Inter 900 30px `#02223C`, body 16px, then an inline email input + solid-orange Subscribe. Close = circled ✕ outline, top-right, the only `rounded-full` element on the page. Backdrop is a light scrim.

### 6.11 Inner-page banner — `screenshots/06-inner-page-hero.png`
Every non-home page opens with a ~450px photographic band under a dark overlay:
- Page title, centred, uppercase, Inter 900 48px white with a soft drop shadow.
- Breadcrumb directly beneath: home glyph + `Home` › `Products`, Inter 400 16px white, current page at 600.

### 6.12 Split content block — `screenshots/07-products-solutions.png`, `screenshots/kiran-about.png`
Alternating text/image rows. Heading Poppins 700 ~36–48px navy, sub-line 16px, image beside or below. The About page uses **photo-print styling** — white-bordered, tilted "polaroid" frames with tape and drop shadow for the archival images. This is the one place where rotation and shadow are permitted; it is a deliberate historical-scrapbook device and should not leak into product UI.

---

## 7. Iconography & imagery

- **Icons:** outlined line-art, ~2px stroke, ~32px, monochrome (navy on white, white on navy). Phone, envelope, LinkedIn, home, chevron. No filled or duotone icons.
- **Decorative dot matrix:** 6×4 grid of small dots, ~24px pitch, used at section corners as a texture. Navy dots on white, white dots on navy.
- **Photography:** real plant/production imagery — steel structures, machinery, cabling. Always cropped wide and darkened. Product shots are close-up on neutral or lightly coloured surfaces.
- **Certificates:** rendered as full document images side by side on the Quality page (`screenshots/kiran-quality.png`), unstyled, at their native white page colour. Effective as proof, weak as design — they should sit in a card or a lightbox with a caption.

---

## 8. Motion

| Effect | Where | Notes |
|---|---|---|
| Scroll reveal | Every section below the fold | Elements start at `opacity: 0` and fade/rise into place on intersection. Content is genuinely invisible until scrolled to — screenshot tooling must scroll the full page first. |
| Parallax | Hero | `background-attachment: fixed` |
| Horizontal scroll | Product rail | Drag/scroll, with a partial card as the affordance |
| Modal entrance | Newsletter | On load |

No hover motion, no micro-interaction on buttons or nav. **Recommendation:** add a 150ms colour/underline transition on nav and buttons — currently interactive elements give no feedback, which reads as unfinished against the otherwise deliberate styling. Also honour `prefers-reduced-motion` for the reveal and parallax.

---

## 9. Responsive behaviour

Single breakpoint in practice: **`md` (768px)**.

| Region | Desktop ≥768px | Mobile <768px |
|---|---|---|
| Header | White utility bar + separate navy nav bar | Collapses into one navy bar: logo left, hamburger right |
| Hero | Left-aligned, 48px H1 | Same stack, reduced type, ~24px gutters |
| Feature cards | 3 across | Stacked full-width |
| Products | Horizontal rail | Horizontal rail retained |
| Stats | 4 across with white dividers | Stacked, dividers dropped |
| Contact | Two columns with vertical rule | Stacked, form below |
| Footer | Links left / newsletter right | Stacked |
| Gutter | 40px | 24px |

Verified: **no horizontal overflow at 390px** (document width 381px). Tablet (768–1024px) is not separately designed — content simply jumps from stacked to full desktop layout at 768px. Adding an `lg` step for the feature cards and stats would remove the cramped 3-up at ~800px.

---

## 10. Design health — findings to address in a rebuild

| # | Issue | Impact | Fix |
|---|---|---|---|
| 1 | White on orange buttons at **2.3 : 1** | Accessibility failure on the primary CTA sitewide | Use `#011627` on orange (6.9 : 1) |
| 2 | Orange links on white at **2.3 : 1** | "Click Here" and inline links unreadable | Darken to `#B26516`, or navy text + orange underline |
| 3 | `body` falls back to Times New Roman | Serif leaks into unstyled text | Set a global sans font-family |
| 4 | Hero uses Inter 900 while all other display type is Poppins | Two competing display voices | Pick one, or scope Inter 900 to full-bleed banners only |
| 5 | Product card copy truncated mid-sentence with `…` | Cards read as broken rather than summarised | Write 12–15 word standardised summaries instead of clamping prose |
| 6 | No hover/focus states on nav, buttons, cards | Site feels static; keyboard focus is invisible | Add hover + a visible `:focus-visible` ring (2px orange offset) |
| 7 | Newsletter modal fires on page load | Blocks the hero on first impression, especially on mobile where it covers the fold | Delay, exit-intent, or convert to an inline footer capture |
| 8 | Client logos at native colours and mixed sizes | Row looks unbalanced against the restrained palette | Normalise to a single grey or navy monotone at equal optical height |
| 9 | Red used exactly once | Reads accidental | Drop it, or define a repeating 3-colour card cycle |
| 10 | Uppercase 48px display with `letter-spacing: normal` | Tight, slightly cramped | `letter-spacing: 0.02em` on uppercase display |
| 11 | Certificate images dropped in raw | Undesigned block on the Quality page | Card + caption + lightbox |
| 12 | No tablet layout | Cramped 768–1024px | Add an `lg` breakpoint for 3-up grids |

None of these require changing the brand colours, the fonts, or the layout language — they are corrections within the existing system.

---

## 11. Do / Don't

**Do**
- Keep every corner at 0 radius. It is the identity.
- Use the notched corner and the dot matrix as the two signature devices, sparingly.
- Alternate white and navy full-bleed bands on an 80px vertical beat.
- Set headings large — 48px display is the house voice, not an exception.
- Darken every photograph before putting type on it.
- Keep orange to accents, CTAs, 8px rules and the soft stats band.

**Don't**
- Don't add rounded corners, drop shadows, gradients, or glass/blur effects.
- Don't put white text on orange.
- Don't introduce a third typeface or a third accent colour.
- Don't use the tilted polaroid treatment outside the About-page history section.
- Don't let orange become a large flat surface at 100% opacity.

---

## 12. Screenshot index

| File | Contents |
|---|---|
| `screenshots/kiran-home-full.png` | Full home page, 1430×4252 |
| `screenshots/01-home-hero.png` | Header, nav, hero |
| `screenshots/02-home-feature-cards.png` | Notched feature cards + "Amazing Products" navy band |
| `screenshots/03-home-products-rail.png` | Horizontal product rail + stats heading |
| `screenshots/04-home-stats-clients.png` | Stats band, dot matrix, client logos |
| `screenshots/05-home-contact-footer.png` | Contact split + footer |
| `screenshots/06-inner-page-hero.png` | Inner-page banner + breadcrumb (Products) |
| `screenshots/07-products-solutions.png` | Dark quality block + split solution rows |
| `screenshots/kiran-products.png` | Full Products page |
| `screenshots/kiran-about.png` | Full About page (polaroid history treatment) |
| `screenshots/kiran-quality.png` | Full Quality page (certificates) |
| `screenshots/kiran-mobile.png` | Mobile 390×844 — collapsed nav + newsletter modal |

---

*Design-only reference. Functionality, content strategy, and performance are out of scope for this document.*
