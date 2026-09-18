/** @type {import('tailwindcss').Config} */
//
// The Ledger design system (LEDGERDESIGNSYSTEM.md), ported onto the console.
//
// The one idea: this is a ruled ledger, not a card dashboard. Depth comes from
// colour contrast and rule weight, never from elevation. Two overrides below sit
// OUTSIDE `extend` on purpose — they replace Tailwind's scales rather than adding
// to them, which is what makes the rule un-breakable page by page:
//
//   borderRadius → 0 everywhere (only `rounded-full` survives, for avatars/dots)
//   boxShadow    → none everywhere
//
// The role tokens the console was authored against (`outline`, `on-surface`,
// `surface-container-*`, `line`, `muted`, …) are kept by name and re-pointed at
// the Ledger greys. That is what carries the system into ~60 pages of existing
// markup without rewriting their class names.
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // §1 — the hard edge is the identity. One rounded button destroys it.
    borderRadius: {
      none: '0', DEFAULT: '0', xs: '0', sm: '0', md: '0', lg: '0', xl: '0',
      '2xl': '0', '3xl': '0', badge: '0', full: '9999px',
    },
    // §1 — depth is contrast + rule weight. Floating panels are held by a
    // hairline and the canvas behind them, not by a shadow.
    boxShadow: {
      none: 'none', DEFAULT: 'none', hairline: 'none', xs: 'none', sm: 'none',
      md: 'none', lg: 'none', xl: 'none', '2xl': 'none', inner: 'none',
      card: 'none', raised: 'none', popover: 'none', modal: 'none',
      'inset-line': 'inset 0 -1px 0 #D2D9DF',
    },
    extend: {
      colors: {
        /* ---------------------------------------------------------------- */
        /* §2.1 Structural greys — the whole system rests on these six       */
        /*                                                                   */
        /* A stop denser than Tailwind's defaults, which matters: a          */
        /* slate-200 hairline disappears at 1px, these don't.                */
        /* ---------------------------------------------------------------- */
        canvas: {
          DEFAULT: '#E9EDF0',   // page ground — never white
          deep: '#DBE2E7',      // pressed / track / secondary ground
        },
        'canvas-deep': '#DBE2E7',
        hairline: {
          DEFAULT: '#D2D9DF',   // the 1px rule, used everywhere
          strong: '#A7B3BE',    // control borders, quiet icons, disabled figures
        },
        'hairline-strong': '#A7B3BE',
        meta: '#5C6975',        // secondary text — 5.6:1 on white, safe for borders
        'ink-strong': '#011627',

        /* ---------------------------------------------------------------- */
        /* §2.2 The two brand slots                                          */
        /*                                                                   */
        /* The console's own marks already sat on these values: the Kiran    */
        /* navy is the `structure` dark neutral, and the amber is `accent`.  */
        /* Dark ink on accent, never white — see the accent-contrast rule.   */
        /* ---------------------------------------------------------------- */
        accent: {
          DEFAULT: '#E99741',
          ink: '#011627',
          foreground: '#011627',
          soft: 'rgba(233, 151, 65, 0.55)',
          link: '#B26516',      // the accent, darkened until it is legible as a link
        },
        'accent-ink': '#011627',
        'accent-link': '#B26516',
        structure: {
          DEFAULT: '#02223C',
          600: '#083352',
          700: '#041C31',
        },

        // Headings, figures, body copy. `text-ink` is the darkest thing on the
        // page; `ink.soft` is the body voice.
        ink: {
          DEFAULT: '#011627',
          soft: '#333333',
          2: '#02223C',
          3: '#083352',
        },
        brand: {
          DEFAULT: '#02223C',
          600: '#083352',
          700: '#041C31',
          900: '#011627',
        },
        kiran: {
          DEFAULT: '#02223C',
          600: '#083352',
          tint: '#E9EDF0',
        },

        // The neutral ramp is re-pointed at the ledger greys so the hundreds of
        // existing `slate-*` classes land inside the system.
        slate: {
          DEFAULT: '#5C6975',
          50: '#F4F6F8',
          100: '#E9EDF0',
          200: '#DBE2E7',
          300: '#D2D9DF',
          400: '#A7B3BE',
          500: '#5C6975',
          600: '#4A5560',
          700: '#3F4A55',
          800: '#02223C',
          900: '#011627',
        },
        line: {
          DEFAULT: '#D2D9DF',
          2: '#E4E8EC',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#F4F6F8',
        },

        // The four fan strands, sampled from the logo mark. Kept for the
        // loader; status now speaks through the tone triplets below.
        strand: {
          red: '#A11020',
          amber: '#8A5A00',
          green: '#0F5B3D',
          teal: '#0B4A78',
        },

        /* ---------------------------------------------------------------- */
        /* §2.3 Status tones — the ink / wash / rule triplet                 */
        /*                                                                   */
        /*   -ink   stamp outline AND stamp text, row spine, 3px stat rule   */
        /*   -bg    a whole-row tint for a callout that needs a ground       */
        /*   -line  soft dividers INSIDE a tinted block — never a control    */
        /* ---------------------------------------------------------------- */
        'st-grey-ink': '#3F4A55',   'st-grey-bg': '#E4E8EC',   'st-grey-line': '#B4BEC7',
        'st-blue-ink': '#0B4A78',   'st-blue-bg': '#DCEAF5',   'st-blue-line': '#7FB0D4',
        'st-amber-ink': '#8A5A00',  'st-amber-bg': '#F8EBD3',  'st-amber-line': '#DFB463',
        'st-red-ink': '#A11020',    'st-red-bg': '#F7DDE0',    'st-red-line': '#E09AA3',
        'st-green-ink': '#0F5B3D',  'st-green-bg': '#DAEEE3',  'st-green-line': '#7FC0A2',

        /* ---------------------------------------------------------------- */
        /* Tailwind's stock status families, folded into the tone triplets   */
        /*                                                                   */
        /* Several hundred call sites across the pages were written as        */
        /* `bg-emerald-50 text-emerald-800 border-emerald-200`. Rather than   */
        /* rewrite them one by one, the four families they use are           */
        /* re-pointed at §2.3, so each resolves to exactly the wash / rule /  */
        /* ink it was reaching for — and there is no pastel left in the       */
        /* build that the system did not sanction.                            */
        /*                                                                   */
        /*   50–100   the wash    (a whole-block ground)                      */
        /*   200–400  the rule    (a soft divider inside that ground)         */
        /*   500–950  the ink     (the stamp outline, its letters, the text)  */
        /* ---------------------------------------------------------------- */
        emerald: {
          50: '#DAEEE3', 100: '#DAEEE3', 200: '#7FC0A2', 300: '#7FC0A2', 400: '#7FC0A2',
          500: '#0F5B3D', 600: '#0F5B3D', 700: '#0F5B3D', 800: '#0F5B3D', 900: '#0B4530', 950: '#08301F',
        },
        green: {
          50: '#DAEEE3', 100: '#DAEEE3', 200: '#7FC0A2', 300: '#7FC0A2', 400: '#7FC0A2',
          500: '#0F5B3D', 600: '#0F5B3D', 700: '#0F5B3D', 800: '#0F5B3D', 900: '#0B4530', 950: '#08301F',
        },
        amber: {
          50: '#F8EBD3', 100: '#F8EBD3', 200: '#DFB463', 300: '#DFB463', 400: '#DFB463',
          500: '#8A5A00', 600: '#8A5A00', 700: '#8A5A00', 800: '#8A5A00', 900: '#6B4600', 950: '#4A3000',
        },
        yellow: {
          50: '#F8EBD3', 100: '#F8EBD3', 200: '#DFB463', 300: '#DFB463', 400: '#DFB463',
          500: '#8A5A00', 600: '#8A5A00', 700: '#8A5A00', 800: '#8A5A00', 900: '#6B4600', 950: '#4A3000',
        },
        red: {
          50: '#F7DDE0', 100: '#F7DDE0', 200: '#E09AA3', 300: '#E09AA3', 400: '#E09AA3',
          500: '#A11020', 600: '#A11020', 700: '#A11020', 800: '#A11020', 900: '#7D0C19', 950: '#560810',
        },
        rose: {
          50: '#F7DDE0', 100: '#F7DDE0', 200: '#E09AA3', 300: '#E09AA3', 400: '#E09AA3',
          500: '#A11020', 600: '#A11020', 700: '#A11020', 800: '#A11020', 900: '#7D0C19', 950: '#560810',
        },
        blue: {
          50: '#DCEAF5', 100: '#DCEAF5', 200: '#7FB0D4', 300: '#7FB0D4', 400: '#7FB0D4',
          500: '#0B4A78', 600: '#0B4A78', 700: '#0B4A78', 800: '#0B4A78', 900: '#083352', 950: '#02223C',
        },
        sky: {
          50: '#DCEAF5', 100: '#DCEAF5', 200: '#7FB0D4', 300: '#7FB0D4', 400: '#7FB0D4',
          500: '#0B4A78', 600: '#0B4A78', 700: '#0B4A78', 800: '#0B4A78', 900: '#083352', 950: '#02223C',
        },
        teal: {
          50: '#DCEAF5', 100: '#DCEAF5', 200: '#7FB0D4', 300: '#7FB0D4', 400: '#7FB0D4',
          500: '#0B4A78', 600: '#0B4A78', 700: '#0B4A78', 800: '#0B4A78', 900: '#083352', 950: '#02223C',
        },
        gray: {
          50: '#F4F6F8', 100: '#E9EDF0', 200: '#DBE2E7', 300: '#D2D9DF', 400: '#A7B3BE',
          500: '#5C6975', 600: '#4A5560', 700: '#3F4A55', 800: '#02223C', 900: '#011627', 950: '#011627',
        },
        // Orange stays out of the status set: it is the accent, and the accent
        // is a call to action, never a verdict.
        orange: {
          50: '#FBEEDC', 100: '#F6DCB9', 200: '#F2CB96', 300: '#EDB96E', 400: '#E99741',
          500: '#E99741', 600: '#B26516', 700: '#8A5A00', 800: '#6B4600', 900: '#4A3000', 950: '#2E1E00',
        },

        /* ---------------------------------------------------------------- */
        /* Role tokens                                                       */
        /*                                                                   */
        /* The chat module and the shadcn primitives were authored against a  */
        /* token vocabulary of their own. Those names are aliases of the      */
        /* ledger palette, so there is still only one palette here —          */
        /* addressed several ways.                                            */
        /* ---------------------------------------------------------------- */
        background: '#E9EDF0',
        foreground: '#011627',
        card: { DEFAULT: '#FFFFFF', foreground: '#011627' },
        popover: { DEFAULT: '#FFFFFF', foreground: '#011627' },
        primary: { DEFAULT: '#E99741', foreground: '#011627' },
        secondary: { DEFAULT: '#E9EDF0', foreground: '#011627' },
        muted: { DEFAULT: '#5C6975', foreground: '#5C6975' },
        destructive: { DEFAULT: '#A11020', foreground: '#FFFFFF' },
        danger: { DEFAULT: '#A11020', foreground: '#FFFFFF' },
        border: '#D2D9DF',
        input: '#A7B3BE',
        ring: '#E99741',
        online: '#0F5B3D',
        ai: { DEFAULT: '#4A3FA0', tint: '#E8E6F4', foreground: '#FFFFFF' },

        /* ---------------------------------------------------------------- */
        /* Surface scale — white sheets ruled onto a grey drafting ground     */
        /* ---------------------------------------------------------------- */
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F4F6F8',
        'surface-container': '#E9EDF0',
        'surface-container-high': '#DBE2E7',
        'surface-container-highest': '#D2D9DF',
        'on-surface': '#011627',
        'on-surface-variant': '#5C6975',
        // `outline` is a text/icon role in this codebase and `outline-variant`
        // is the rule. Pointing them at meta and hairline is the single change
        // that carries the ledger greys into every existing page.
        'outline': '#5C6975',
        'outline-variant': '#D2D9DF',
        'primary-container': '#02223C',
        'on-primary': '#FFFFFF',
        'on-primary-container': '#E9EDF0',
        'secondary-container': '#DCEAF5',
        'on-secondary-container': '#0B4A78',
        'tertiary-container': '#0F5B3D',
        'tertiary-fixed': '#DAEEE3',
        'tertiary-fixed-dim': '#7FC0A2',
        'on-tertiary-fixed': '#011627',
      },

      /* ------------------------------------------------------------------ */
      /* §3 Type — two faces, three voices                                   */
      /*                                                                     */
      /* The display voice is not a second typeface: it is Archivo set on    */
      /* its `wdth` axis (see .ku-wide / .ku-xwide / .ku-narrow in index.css)*/
      /* ------------------------------------------------------------------ */
      fontFamily: {
        sans: ['Archivo', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Archivo', 'system-ui', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      // Negative tracking on every large step, positive on every small one.
      fontSize: {
        micro: ['11px', { lineHeight: '14px', letterSpacing: '0.1em' }],
        caption: ['12px', { lineHeight: '16px' }],
        'body-s': ['14px', { lineHeight: '20px' }],
        body: ['16px', { lineHeight: '24px' }],
        lead: ['18px', { lineHeight: '26px' }],
        h3: ['20px', { lineHeight: '26px', letterSpacing: '-0.005em' }],
        h2: ['28px', { lineHeight: '32px', letterSpacing: '-0.015em' }],
        h1: ['38px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
        figure: ['34px', { lineHeight: '36px', letterSpacing: '-0.04em' }],
        'figure-lg': ['46px', { lineHeight: '46px', letterSpacing: '-0.05em' }],
        display: ['62px', { lineHeight: '58px', letterSpacing: '-0.05em' }],
      },
      letterSpacing: { display: '-0.02em', stamp: '0.14em', eyebrow: '0.18em' },
      // 3px is load-bearing in this system: it caps a stat cell, rules a table
      // head, and draws the page spine.
      borderWidth: { 3: '3px', 6: '6px' },
      spacing: { 18: '4.5rem', 22: '5.5rem', section: '80px' },
      maxWidth: { container: '1280px', shell: '1600px' },

      transitionTimingFunction: {
        'out-refined': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: { 150: '150ms' },

      /* ------------------------------------------------------------------ */
      /* §7 Motion — decisive, short, one easing curve                       */
      /* ------------------------------------------------------------------ */
      keyframes: {
        'msg-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.99)' },
          to: { opacity: '1', transform: 'none' },
        },
        'ai-glow': {
          '0%, 100%': { opacity: '0.72' },
          '50%': { opacity: '1' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(15, 91, 61, 0.55)' },
          '70%': { boxShadow: '0 0 0 5px rgba(15, 91, 61, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(15, 91, 61, 0)' },
        },
        'page-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        // The stamp lands: it arrives rotated and oversized, then sets on paper.
        'stamp-in': {
          '0%': { opacity: '0', transform: 'rotate(-9deg) scale(1.5)' },
          '55%': { opacity: '1', transform: 'rotate(-3.5deg) scale(0.96)' },
          '100%': { opacity: '1', transform: 'rotate(-3deg) scale(1)' },
        },
        // The signature: every rule draws in from the left, like a pen across
        // a ledger line. Always pair with `origin-left`.
        'rule-in': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
      },
      animation: {
        'msg-in': 'msg-in 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'ai-glow': 'ai-glow 2.4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s infinite',
        'page-in': 'page-in 260ms cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 200ms cubic-bezier(0.22,1,0.36,1) both',
        'stamp-in': 'stamp-in 340ms cubic-bezier(0.3,1.4,0.5,1) both',
        'rule-in': 'rule-in 420ms cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}
