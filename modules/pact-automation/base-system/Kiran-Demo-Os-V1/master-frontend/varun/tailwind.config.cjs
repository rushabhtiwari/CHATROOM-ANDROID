/** @type {import('tailwindcss').Config} */
//
// Kiran design language (docs/design-language.md), shared with the portal and
// the department workspaces: quiet grey chrome, white rounded groups, one blue,
// hairlines instead of shadows.
//
// The token NAMES the console was authored against (`outline`, `on-surface`,
// `surface-container-*`, `line`, `muted`, `structure`, `st-*` ...) are kept and
// re-pointed at the shared palette, which is what carries the look into every
// page without rewriting class names.
const GREY = {
  50: '#FBFBFC', 100: '#F4F4F6', 200: '#E6E6EB', 300: '#D8D8DE', 400: '#9A9AA2',
  500: '#6E6E76', 600: '#5B5B63', 700: '#3A3A40', 800: '#2C2C30', 900: '#1D1D1F', 950: '#1D1D1F',
};
const tone = (wash, line, ink, deep) => ({
  50: wash, 100: wash, 200: line, 300: line, 400: line,
  500: ink, 600: ink, 700: ink, 800: ink, 900: deep, 950: deep,
});
const GREEN = tone('#E7F3EB', '#B5D9C3', '#17723F', '#0F5230');
const AMBER = tone('#FBEFDC', '#EBCB94', '#8A4F00', '#663A00');
const RED = tone('#FBE9E7', '#EDB5B0', '#B3302A', '#87231F');
const BLUE = tone('#E7EFFA', '#B3CDEE', '#0A63C9', '#0B4F9C');

module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // 8px controls, 12px cards, 16px dialogs.
    borderRadius: {
      none: '0', xs: '4px', sm: '6px', DEFAULT: '8px', md: '8px', lg: '12px', xl: '16px',
      '2xl': '16px', '3xl': '20px', badge: '6px', full: '9999px',
    },
    // Space before lines, lines before shadows. Only popovers and dialogs float.
    boxShadow: {
      none: 'none', DEFAULT: 'none', hairline: 'none', xs: 'none', sm: 'none',
      md: 'none', inner: 'none', card: 'none', raised: 'none',
      lg: '0 8px 24px rgba(0, 0, 0, 0.10)',
      xl: '0 12px 32px rgba(0, 0, 0, 0.12)',
      '2xl': '0 20px 48px rgba(0, 0, 0, 0.16)',
      popover: '0 8px 24px rgba(0, 0, 0, 0.10), 0 0 0 1px rgba(0, 0, 0, 0.04)',
      modal: '0 20px 48px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04)',
      'inset-line': 'inset 0 -1px 0 #E6E6EB',
    },
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#F7F7F9',   // page background
          deep: '#EFEFF2',      // pressed / track / quiet fill
        },
        'canvas-deep': '#EFEFF2',
        sidebar: '#F2F2F5',
        hairline: {
          DEFAULT: '#E6E6EB',   // borders, dividers
          2: '#EEEEF1',         // row dividers
          strong: '#D8D8DE',    // control borders
        },
        'hairline-strong': '#D8D8DE',
        meta: '#5B5B63',        // secondary text, 6.4:1 on white
        faint: '#6E6E76',       // icons, placeholders
        'ink-strong': '#1D1D1F',
        navy: '#02223C',        // brand mark only

        // The one blue: actions, links, selection.
        accent: {
          DEFAULT: '#0A63C9',
          hover: '#0855AD',
          tint: '#E7EFFA',
          ink: '#FFFFFF',
          foreground: '#FFFFFF',
          soft: 'rgba(10, 99, 201, 0.35)',
          link: '#0A63C9',
        },
        'accent-ink': '#FFFFFF',
        'accent-link': '#0A63C9',
        // Formerly the navy "structure" rule. Now simply the darkest neutral.
        structure: {
          DEFAULT: '#1D1D1F',
          600: '#2C2C30',
          700: '#000000',
        },

        ink: {
          DEFAULT: '#1D1D1F',
          soft: '#3A3A40',
          2: '#3A3A40',
          3: '#5B5B63',
        },
        brand: {
          DEFAULT: '#0A63C9',
          600: '#0855AD',
          700: '#0B4F9C',
          900: '#0B4F9C',
        },
        kiran: {
          DEFAULT: '#0A63C9',
          600: '#0855AD',
          tint: '#E7EFFA',
        },

        slate: { DEFAULT: '#5B5B63', ...GREY },
        gray: GREY,
        line: {
          DEFAULT: '#E6E6EB',
          2: '#EEEEF1',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#FBFBFC',
        },

        strand: {
          red: '#B3302A',
          amber: '#8A4F00',
          green: '#17723F',
          teal: '#0A63C9',
        },

        // Status tones: ink (text + dot), wash (pill ground), line (soft divider).
        'st-grey-ink': '#48484F',   'st-grey-bg': '#EFEFF2',   'st-grey-line': '#D8D8DE',
        'st-blue-ink': '#0B4F9C',   'st-blue-bg': '#E7EFFA',   'st-blue-line': '#B3CDEE',
        'st-amber-ink': '#8A4F00',  'st-amber-bg': '#FBEFDC',  'st-amber-line': '#EBCB94',
        'st-red-ink': '#B3302A',    'st-red-bg': '#FBE9E7',    'st-red-line': '#EDB5B0',
        'st-green-ink': '#17723F',  'st-green-bg': '#E7F3EB',  'st-green-line': '#B5D9C3',

        // Tailwind's stock status families, folded into the same tones.
        emerald: GREEN,
        green: GREEN,
        amber: AMBER,
        yellow: AMBER,
        orange: AMBER,
        red: RED,
        rose: RED,
        blue: BLUE,
        sky: BLUE,
        teal: BLUE,

        // Role tokens (chat module, shadcn primitives): aliases of the palette.
        background: '#F7F7F9',
        foreground: '#1D1D1F',
        card: { DEFAULT: '#FFFFFF', foreground: '#1D1D1F' },
        popover: { DEFAULT: '#FFFFFF', foreground: '#1D1D1F' },
        primary: { DEFAULT: '#0A63C9', foreground: '#FFFFFF' },
        secondary: { DEFAULT: '#F4F4F6', foreground: '#1D1D1F' },
        muted: { DEFAULT: '#5B5B63', foreground: '#5B5B63' },
        destructive: { DEFAULT: '#B3302A', foreground: '#FFFFFF' },
        danger: { DEFAULT: '#B3302A', foreground: '#FFFFFF' },
        success: { DEFAULT: '#17723F', foreground: '#FFFFFF' },
        warning: { DEFAULT: '#8A4F00', foreground: '#FFFFFF' },
        border: '#E6E6EB',
        input: '#D8D8DE',
        ring: '#0A63C9',
        online: '#17723F',
        ai: { DEFAULT: '#4A3FA0', tint: '#E8E6F4', foreground: '#FFFFFF' },

        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#FBFBFC',
        'surface-container': '#F4F4F6',
        'surface-container-high': '#EFEFF2',
        'surface-container-highest': '#E6E6EB',
        'on-surface': '#1D1D1F',
        'on-surface-variant': '#5B5B63',
        'outline': '#5B5B63',
        'outline-variant': '#E6E6EB',
        'primary-container': '#0A63C9',
        'on-primary': '#FFFFFF',
        'on-primary-container': '#FFFFFF',
        'secondary-container': '#E7EFFA',
        'on-secondary-container': '#0B4F9C',
        'tertiary-container': '#17723F',
        'tertiary-fixed': '#E7F3EB',
        'tertiary-fixed-dim': '#B5D9C3',
        'on-tertiary-fixed': '#1D1D1F',
      },

      // Geist for everything. `font-mono` is deliberately the SAME sans stack
      // (with tabular figures, see index.css): ordinary numbers, dates and
      // amounts are not monospace. `font-code` is Geist Mono, for record numbers.
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        code: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        micro: ['12px', { lineHeight: '16px' }],
        caption: ['13px', { lineHeight: '18px' }],
        'body-s': ['14px', { lineHeight: '21px' }],
        body: ['15px', { lineHeight: '22px' }],
        lead: ['16px', { lineHeight: '24px' }],
        h3: ['16px', { lineHeight: '24px' }],
        h2: ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        h1: ['26px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        figure: ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
        'figure-lg': ['32px', { lineHeight: '38px', letterSpacing: '-0.02em' }],
        display: ['40px', { lineHeight: '44px', letterSpacing: '-0.02em' }],
      },
      letterSpacing: { display: '-0.02em', stamp: '0', eyebrow: '0' },
      borderWidth: { 3: '3px', 6: '6px' },
      spacing: { 18: '4.5rem', 22: '5.5rem', section: '80px' },
      maxWidth: { container: '1280px', shell: '1600px' },

      transitionTimingFunction: {
        'out-refined': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: { 150: '150ms' },

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
          '0%': { boxShadow: '0 0 0 0 rgba(23, 114, 63, 0.45)' },
          '70%': { boxShadow: '0 0 0 5px rgba(23, 114, 63, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(23, 114, 63, 0)' },
        },
        'page-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'stamp-in': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'rule-in': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
      },
      animation: {
        'msg-in': 'msg-in 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'ai-glow': 'ai-glow 2.4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s infinite',
        'page-in': 'page-in 220ms cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 180ms cubic-bezier(0.22,1,0.36,1) both',
        'stamp-in': 'stamp-in 180ms cubic-bezier(0.22,1,0.36,1) both',
        'rule-in': 'rule-in 300ms cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}

