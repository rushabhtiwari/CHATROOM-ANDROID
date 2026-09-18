/** @type {import('tailwindcss').Config} */
// Brand tokens are transcribed 1:1 from design.md §3 (colour) and §5 (layout & spacing).
// The layer on top of them is the "Works Ledger" direction: an industrial ledger for a
// plant accounts office — ruled bands, stamped statuses, monospace figures.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // design.md §5: "Border radius: 0px globally." Only rounded-full is permitted.
    borderRadius: { none: '0', DEFAULT: '0', sm: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0', full: '9999px' },
    // design.md §5: "No box-shadows anywhere. Depth comes from colour contrast, not shadow."
    boxShadow: { none: 'none', DEFAULT: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none', inner: 'none' },
    extend: {
      colors: {
        // §3.5 live-site token names, kept 1:1 with the existing codebase
        'rich-black': '#011627',
        'darkey-bluey': '#02223C',
        orangy: '#E99741',
        'lighty-orangey': 'rgba(233,151,65,0.55)',
        washed: '#E71D36',
        'dark-white': '#EBEBEB',
        'light-black': '#333333',
        // §3.4 accessible pairings
        'on-orange': '#011627',
        'link-on-light': '#B26516',
        meta: '#5C6975',
        // Application surfaces. Cooler and a stop denser than a default dashboard grey —
        // the ground should read as a drafting sheet, and rules must survive at 1px.
        hairline: '#D2D9DF',
        'hairline-strong': '#A7B3BE',
        canvas: '#E9EDF0',
        'canvas-deep': '#DBE2E7',
        'navy-800': '#041C31',
        'navy-700': '#083352',
        'navy-600': '#0E4368',
        'navy-500': '#175A87',
        // Status hues. Ink and rule do the work; the wash is a row tint, never a pill fill.
        'st-grey-ink': '#3F4A55',   'st-grey-bg': '#E4E8EC',   'st-grey-line': '#B4BEC7',
        'st-blue-ink': '#0B4A78',   'st-blue-bg': '#DCEAF5',   'st-blue-line': '#7FB0D4',
        'st-amber-ink': '#8A5A00',  'st-amber-bg': '#F8EBD3',  'st-amber-line': '#DFB463',
        'st-red-ink': '#A11020',    'st-red-bg': '#F7DDE0',    'st-red-line': '#E09AA3',
        'st-green-ink': '#0F5B3D',  'st-green-bg': '#DAEEE3',  'st-green-line': '#7FC0A2',
      },
      fontFamily: {
        // Archivo carries both roles; the display voice is the same face set expanded
        // (see .ku-wide / .ku-xwide in index.css), which is how the wordmark behaves.
        sans: ['Archivo', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Archivo', 'system-ui', 'Helvetica Neue', 'Arial', 'sans-serif'],
        // The instrument voice: money, UTRs, IFSCs, docket numbers, dates, counts.
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Stamped labels: mono, uppercase, widely tracked. The smallest step in the system.
        micro: ['11px', { lineHeight: '14px', letterSpacing: '0.1em' }],
        caption: ['12px', { lineHeight: '16px' }],
        'body-s': ['14px', { lineHeight: '20px' }],
        body: ['16px', { lineHeight: '24px' }],
        lead: ['18px', { lineHeight: '26px' }],
        h3: ['20px', { lineHeight: '26px', letterSpacing: '-0.005em' }],
        h2: ['28px', { lineHeight: '32px', letterSpacing: '-0.015em' }],
        h1: ['38px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
        // Ledger figures — the totals that anchor a page.
        figure: ['34px', { lineHeight: '36px', letterSpacing: '-0.04em' }],
        'figure-lg': ['46px', { lineHeight: '46px', letterSpacing: '-0.05em' }],
        display: ['62px', { lineHeight: '58px', letterSpacing: '-0.05em' }],
      },
      spacing: { 18: '4.5rem', 22: '5.5rem', section: '80px' },
      maxWidth: { container: '1280px', shell: '1600px' },
      letterSpacing: { display: '-0.02em', stamp: '0.14em', eyebrow: '0.18em' },
      borderWidth: { 3: '3px', 6: '6px' },
      transitionDuration: { 150: '150ms' },
      keyframes: {
        'fade-rise': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
        'slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        'page-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'draw-check': { '0%': { strokeDashoffset: '48' }, '100%': { strokeDashoffset: '0' } },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '60%': { opacity: '1', transform: 'scale(1.06)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // The stamp lands: it arrives rotated and oversized, then sets on the paper.
        'stamp-in': {
          '0%': { opacity: '0', transform: 'rotate(-9deg) scale(1.5)' },
          '55%': { opacity: '1', transform: 'rotate(-3.5deg) scale(0.96)' },
          '100%': { opacity: '1', transform: 'rotate(-3deg) scale(1)' },
        },
        // A ruled band draws in from the left, like a pen across a ledger line.
        'rule-in': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
      },
      animation: {
        'fade-rise': 'fade-rise 180ms ease-out both',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        // Cubic-bezier(0.22, 1, 0.36, 1) — a decisive ease-out, no overshoot.
        'page-in': 'page-in 260ms cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 200ms cubic-bezier(0.22,1,0.36,1) both',
        'pop-in': 'pop-in 420ms cubic-bezier(0.22,1,0.36,1) both',
        'stamp-in': 'stamp-in 340ms cubic-bezier(0.3,1.4,0.5,1) both',
        'rule-in': 'rule-in 420ms cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
