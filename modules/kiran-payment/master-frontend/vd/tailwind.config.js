/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ---------------------------------------------------------------- */
        /* Brand — sampled from the Kiran Cable Protection wordmark          */
        /* ---------------------------------------------------------------- */
        ink: {
          DEFAULT: '#1D1D1F',
          2: '#2C2C30',
          3: '#3A3A40',
        },
        brand: {
          DEFAULT: '#0A63C9',
          600: '#0855AD',
          700: '#0B4F9C',
          900: '#02223C',
        },
        // Neutral greys, no colour cast.
        slate: {
          DEFAULT: '#5B5B63',
          50: '#FBFBFC',
          100: '#F4F4F6',
          200: '#E6E6EB',
          300: '#D8D8DE',
          400: '#9A9AA2',
          500: '#6E6E76',
          600: '#5B5B63',
          700: '#3A3A40',
          800: '#2C2C30',
          900: '#1D1D1F',
        },
        line: {
          DEFAULT: '#E6E6EB',
          2: '#EEEEF1',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#FBFBFC',
        },
        canvas: {
          DEFAULT: '#F7F7F9',
        },
        kiran: {
          DEFAULT: '#0A63C9',
          600: '#0855AD',
          tint: '#E7EFFA',
        },
        // Status hues (names kept from the old logo strands)
        strand: {
          red: '#B3302A',
          amber: '#A96500',
          green: '#17723F',
          teal: '#0A63C9',
        },

        /* Role tokens: shadcn-style aliases of the same palette (chat module) */
        background: '#F7F7F9',
        foreground: '#1D1D1F',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#1D1D1F',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#1D1D1F',
        },
        primary: {
          DEFAULT: '#0A63C9',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#F4F4F6',
          foreground: '#1D1D1F',
        },
        accent: {
          DEFAULT: '#E7EFFA',
          foreground: '#0B4F9C',
        },
        muted: {
          DEFAULT: '#5B5B63',
          foreground: '#5B5B63',
        },
        destructive: {
          DEFAULT: '#B3302A',
          foreground: '#FFFFFF',
        },
        border: '#E6E6EB',
        input: '#D8D8DE',
        ring: '#0A63C9',
        online: '#17723F',
        ai: {
          DEFAULT: '#0A63C9',
          tint: '#E7EFFA',
          foreground: '#FFFFFF',
        },
      },
      fontFamily: {
        display: ['Geist', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        sans: ['Geist', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        // Deliberately the sans stack: amounts and dates are ordinary text.
        mono: ['Geist', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        // Record numbers only (PO-..., REQ-...).
        code: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        badge: '6px',
      },
      boxShadow: {
        'hairline': '0 0 0 1px #E6E6EB',
        'xs': 'none',
        'card': 'none',
        'raised': 'none',
        'popover': '0 10px 30px -8px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.05)',
        'modal': '0 24px 64px -12px rgba(0, 0, 0, 0.24), 0 8px 20px -8px rgba(0, 0, 0, 0.10)',
        'inset-line': 'inset 0 -1px 0 #E6E6EB',
      },
      transitionTimingFunction: {
        'out-refined': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
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
          '0%': { boxShadow: '0 0 0 0 rgba(23, 114, 63, 0.55)' },
          '70%': { boxShadow: '0 0 0 5px rgba(23, 114, 63, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(23, 114, 63, 0)' },
        },
      },
      animation: {
        'msg-in': 'msg-in 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        'ai-glow': 'ai-glow 2.4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s infinite',
      },
    },
  },
  plugins: [],
}
