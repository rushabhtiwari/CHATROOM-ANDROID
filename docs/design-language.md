# Kiran design language

One look for Central (the portal), the department workspaces, PACT, and Projects (KCMS).
It follows the Atlas reference: quiet grey chrome, white content, one blue, hairlines instead of
shadows. Where Atlas is dense, this is roomier: the people using it are not technical, so there
is less text, more space, and the main button on a screen is unmistakable.

## Rules

1. **Say it once.** A page has a title. It does not also have a subtitle explaining the title,
   an eyebrow above it, or a caption under each number. If a label needs a sentence to explain
   it, rename the label.
2. **One main action per screen**, blue, 44 px high, top right. Everything else is a quiet
   white button (36 px) or an icon button.
3. **Sentence case everywhere.** No UPPERCASE labels, no letter-spaced eyebrows, no monospace
   for ordinary numbers, dates or amounts. Monospace is for record numbers only (`SO-2026-0877`).
4. **Colour means status.** Blue = something you can act on. Green / amber / red = status, always
   with a word. Icons and tiles are neutral grey. No gradients.
5. **Space before lines.** Separate with whitespace first, a hairline second, never a shadow
   (popovers and dialogs excepted). Page padding 32 px, 24 px between groups, 16 px inside cards.
6. **The same frame everywhere.** Light grey sidebar (248 px) · white toolbar (56 px) · grey canvas
   · white rounded groups.

## Tokens

| Token | Value | Use |
|---|---|---|
| canvas | `#F7F7F9` | page background |
| sidebar | `#F2F2F5` | navigation rail |
| surface | `#FFFFFF` | toolbar, cards, tables |
| surface-2 | `#FBFBFC` | table heads, quiet fills |
| hairline | `#E6E6EB` | borders, dividers |
| hairline-2 | `#EEEEF1` | row dividers |
| control-border | `#D8D8DE` | inputs, secondary buttons |
| ink | `#1D1D1F` | primary text |
| ink-2 | `#3A3A40` | body text |
| muted | `#5B5B63` | secondary text (6.4 : 1) |
| faint | `#6E6E76` | icons, placeholders |
| navy | `#02223C` | brand mark only |
| accent | `#0A63C9` | actions, links, selection |
| accent-hover | `#0855AD` | |
| accent-tint | `#E7EFFA` | selected row, info |
| nav-active | `#DCE6F4` bg / `#0B4F9C` text | current sidebar item |
| success | `#17723F` on `#E7F3EB` | |
| warning | `#8A4F00` on `#FBEFDC` | |
| danger | `#B3302A` on `#FBE9E7` | |
| neutral | `#48484F` on `#EFEFF2` | |
| alert dot | `#D93A2F` | unread / late counts |

**Type** — Geist for everything, Geist Mono for record numbers. Self-hosted variable fonts
(`geist-latin.woff2` …), falling back to the system UI font.

| Style | Size / weight |
|---|---|
| Page title | 26 / 600 / −0.02em |
| Section title | 16 / 600 |
| Key number | 28 / 600 / tabular |
| Body | 14 / 400 / 1.5 |
| Label, caption | 13 / 500, muted |
| Sidebar item | 14 / 500, 36 px row |

**Shape** — 8 px controls, 12 px cards, 16 px dialogs, round avatars. Hairline borders, no card shadow.

**Controls**

| Control | Spec |
|---|---|
| Primary button | 44 px, 0 20 px, 15/600, accent fill, white text, 10 px radius |
| Secondary button | 36 px, 0 14 px, 14/500, white, control-border |
| Icon button | 36 × 36, transparent, hover `rgba(0,0,0,.05)` |
| Input / select | 40 px, 8 px radius, control-border, 14 px text |
| Table row | 52 px min, hairline-2 divider, hover canvas |
| Status pill | 24 px, 6 px radius, 6 px dot + word, tinted |
| Segmented control | 32 px track `#EBEBEF`, white selected segment |
| Sidebar group label | 12 / 600, faint, sentence case |
