---
name: Precision Engineering Canvas
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#424750'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#727781'
  outline-variant: '#c2c6d1'
  surface-tint: '#2d6099'
  primary: '#00305b'
  on-primary: '#ffffff'
  primary-container: '#06477f'
  on-primary-container: '#88b6f5'
  inverse-primary: '#a3c9ff'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#003824'
  on-tertiary: '#ffffff'
  tertiary-container: '#005136'
  on-tertiary-container: '#35cc92'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d3e3ff'
  primary-fixed-dim: '#a3c9ff'
  on-primary-fixed: '#001c39'
  on-primary-fixed-variant: '#084880'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  title-page:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  header-section:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-default:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-medium:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  caption-meta:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  caption-meta-medium:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  code-badge:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
  shortcut-key:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  row-height: 36px
  row-height-compact: 28px
  pad-xs: 4px
  pad-sm: 8px
  pad-md: 12px
  pad-lg: 16px
  gap-inline: 6px
  sidebar-width: 240px
  inspector-width: 320px
---

## Brand & Style

This design system is engineered for high-velocity internal enterprise tooling, issue tracking, and system telemetry where information density and keyboard efficiency are paramount. Drawing inspiration from modern high-performance tools like Linear and GitHub Issues, the interface acts as a quiet, razor-sharp instrument that recedes into the background, prioritizing data visibility and direct manipulation over decorative flourishes.

The visual style is strictly utilitarian, structured, and modern-corporate. It embraces precision grid alignment, hairline separators, compact spatial packaging, and instant micro-interactions. The emotional target is authoritative confidence, operational speed, and frictionless data triage.

## Colors

The palette is engineered for prolonged operational use in light mode, minimizing visual fatigue while preserving strict contrast ratios.

- **Canvas Background:** `#F4F6F9` provides a cool, low-glare foundation that visually separates raised operational panels.
- **Surface & Cards:** Pure `#FFFFFF` cards and panels establish immediate hierarchy over the light grey-blue canvas.
- **Borders & Dividers:** Crisp 1px lines using `#E2E8F0` delineate grid boundaries and list rows. Sub-item dividers and inactive tracks use `#F1F5F9`.
- **Text Tiers:** Primary headers and standard text utilize high-contrast `#0F172A` (Slate 900). Secondary metadata, timestamps, and column labels rely on `#64748B` (Slate 500). Muted placeholder text uses `#94A3B8`.
- **Primary Accent:** Deep corporate blue `#06477F` anchors key action triggers, focused states, and selected tab indicators.
- **Interactive States:** Row and action button hovers trigger `#F8FAFC`, while selection overlays apply a subtle 8% tint of `#06477F`.
- **Status Semantic Dots:**
  - Backlog / Triage: `#94A3B8`
  - Todo / Planned: `#F59E0B`
  - In Progress: `#0284C7`
  - Done / Resolved: `#10B981`
  - Canceled / Blocked: `#EF4444`

## Typography

The type scale is calibrated for exceptional information density across large datasets, tabular grids, and nested lists. 

- **Primary Interface Font:** `Inter` handles all structural headers, body copy, and UI controls.
- **Monospace Font:** `JetBrains Mono` is strictly reserved for issue identifiers (e.g., `ENG-1042`), git commits, numeric counters, and code chips.
- **Type Hierarchy Rules:** Page titles are constrained to 16px to prevent vertical space consumption. Section headings, column groupings, and pane titles stay at 14px semi-bold. The primary interactive body size is 13px, balancing immediate legibility with screen efficiency. All secondary attributes, assignees, dates, and breadcrumbs scale down to 12px. Uppercase 11px monospace is enforced for all issue tags and keys.

## Layout & Spacing

Layouts follow an ultra-dense, full-viewport application architecture (`100vh` without page body scrollbars; scroll containers are isolated to data panes).

- **Grid Architecture:** Multi-pane workspace composed of a collapsible 240px navigation sidebar, a fluid primary data table or board occupying the center, and an optional 320px context/inspector drawer on the right.
- **Vertical Rhythm:** Primary table rows and issue list elements are standardized to an exact 36px fixed height (`row-height`). Secondary dense sub-lists and dropdown items compress to 28px (`row-height-compact`).
- **Inline Spacing:** Horizontal gaps between metadata icons, status chips, and text adhere to 6px or 8px increments. Outer container margins maintain a strict 16px boundary, while internal card padding stays compact at 12px.
- **Responsive Adaptations:** Below 1024px, the inspector collapses into an overlay modal sheet, and the sidebar collapses to an icon rail (48px). Mobile layouts stack views into a single scrollable feed with sticky bottom-anchored actions.

## Elevation & Depth

Visual hierarchy is communicated through hairline 1px borders and razor-thin ambient shadows rather than dramatic blur spreads or tonal elevations.

- **Surface Levels:** 
  - Level 0 (Base Canvas): `#F4F6F9`
  - Level 1 (Work Surfaces / Tables / Cards): `#FFFFFF` bounded by a 1px solid `#E2E8F0` border.
  - Level 2 (Dropdowns / Context Menus / Popovers): `#FFFFFF` with border `#E2E8F0` and shadow `0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05)`.
  - Level 3 (Modals / Command Palettes): `#FFFFFF` with shadow `0 8px 30px rgba(0, 0, 0, 0.12)`.
- **Card Shadow:** Everyday content cards use a flat hairline treatment: border `1px solid #E2E8F0` and minimal shadow `0 1px 2px rgba(0, 0, 0, 0.04)`.
- **Hover & Drag States:** Active row drags gain an elevated shadow `0 4px 12px rgba(0, 0, 0, 0.08)` and a `#06477F` hairline accent ring.

## Shapes

The geometric personality is compact and disciplined. Rounded corners are subtle and purposeful, maintaining clean geometric lines without appearing blocky or unpolished.

- **Buttons, Form Controls & Inputs:** 6px radius (`rounded-md` in standard 4px/6px scales), providing ergonomic containment for compact 28px and 32px touch/click targets.
- **Badges, Monospace IDs & Metadata Chips:** 4px radius (`rounded-sm`), establishing a tighter, more technical visual profile.
- **Cards & Data Tables:** 6px outer container radius with 0px radius on internal alternating rows.
- **Status Indicator Dots:** Full 50% circle radius (6px x 6px diameter).
- **Iconography:** Crisp 1.5px stroke weights with flat or micro-rounded caps conforming to a strict 14px or 16px bounding frame.

## Components

- **Buttons:**
  - *Primary:* `#06477F` background, `#FFFFFF` text, 6px radius, height 28px (compact) or 32px (standard), horizontal padding 10px, 13px medium typography. Hover: `#053763`. Active: `#042a4d`.
  - *Secondary / Ghost:* Transparent background, `#0F172A` text, 1px border `#E2E8F0`. Hover: `#F8FAFC`.
  - *Keyboard Shortcut Indicator:* Embedded `<kbd>` badge rendered with 4px radius, `#F1F5F9` background, 1px border `#E2E8F0`, and 10px uppercase type.

- **Table & List Rows:**
  - Standardized height of 36px. Direct flex layout: status icon (14px), issue ID (11px mono), title (13px text-slate-900, truncated), flexible spacer, assignee avatar (18px circle), priority indicator, and updated timestamp (12px text-slate-500).
  - Background: `#FFFFFF`. Hover: `#F8FAFC`. Selected: `#F0F6FA` with a 2px left border accent in `#06477F`.

- **Input Fields & Search Bars:**
  - Height 30px, 6px radius, background `#FFFFFF`, border 1px solid `#E2E8F0`, text 13px. 
  - Focus state: border color `#06477F`, with an outer focus ring `0 0 0 1px #06477F`.
  - Filter input fields display embedded leading shortcut icons (e.g., `/` to filter).

- **Badges & Chips:**
  - Monospace ID Badges: 4px radius, `#F1F5F9` fill, `#475569` text, padding 2px 5px, 11px font.
  - Priority Badges: Clean icon with subtle stroke, no background fill to prevent visual clutter across 100+ visible issues.
  - Status Dots: 6px solid circular indicators accompanied by 12px medium label text.

- **Checkboxes & Selection Radios:**
  - 14px x 14px square, 3px border radius, border 1.5px solid `#CBD5E1`. Checked state: `#06477F` fill with crisp white checkmark glyph.

- **Command Palette (KBar / Quick Actions):**
  - Center-anchored floating modal (600px width), 8px radius, border 1px solid `#E2E8F0`, elevation Level 3.
  - Quick action rows: 32px height, 13px typography, keyboard navigational highlight `#F1F5F9`.