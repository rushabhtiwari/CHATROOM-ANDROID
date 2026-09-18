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
          DEFAULT: '#0A2547',
          2: '#123863',
          3: '#1D4A7C',
        },
        brand: {
          DEFAULT: '#06477F',
          600: '#053D6E',
          700: '#04305A',
          900: '#031F3B',
        },
        // Neutral ramp retuned to a navy cast so every gray in the console
        // sits in the same family as the brand mark.
        slate: {
          DEFAULT: '#4A5A70',
          50: '#F7F9FC',
          100: '#EFF3F8',
          200: '#E1E8F1',
          300: '#C7D2E0',
          400: '#94A3B8',
          500: '#6E7F96',
          600: '#55657A',
          700: '#3D4C61',
          800: '#2A384A',
          900: '#1B2735',
        },
        line: {
          DEFAULT: '#E4E9F0',
          2: '#EEF2F7',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#F7FAFD',
        },
        canvas: {
          DEFAULT: '#F4F7FB',
        },
        kiran: {
          DEFAULT: '#06477F',
          600: '#05609E',
          tint: '#EAF2F9',
        },
        // The four fan strands, sampled from the logo mark
        strand: {
          red: '#B5070E',
          amber: '#E9991B',
          green: '#018F3D',
          teal: '#00AEEF',
        },

        /* ---------------------------------------------------------------- */
        /* Role tokens                                                       */
        /*                                                                   */
        /* The chat module was authored against a shadcn token vocabulary    */
        /* (primary / secondary / muted-foreground / border / …). Rather     */
        /* than rewrite two thousand class names, those names are defined    */
        /* here as aliases of the Kiran palette above. The chat therefore    */
        /* inherits the console's colour system by construction — there is   */
        /* only one palette in this application, addressed two ways.         */
        /* ---------------------------------------------------------------- */
        background: '#F4F7FB',
        foreground: '#0A2547',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0A2547',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#0A2547',
        },
        primary: {
          DEFAULT: '#06477F',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#EFF3F8',
          foreground: '#1B2735',
        },
        accent: {
          DEFAULT: '#EAF2F9',
          foreground: '#04305A',
        },
        // `muted` is a text colour in the console (`text-muted`) and a surface
        // in shadcn (`bg-muted`). Both readings resolve correctly: the DEFAULT
        // is the grey the console has always used, and `bg-muted` is remapped
        // to `bg-line-2` in the chat module during the port.
        muted: {
          DEFAULT: '#75849A',
          foreground: '#75849A',
        },
        destructive: {
          DEFAULT: '#B5070E',
          foreground: '#FFFFFF',
        },
        border: '#E4E9F0',
        input: '#C7D2E0',
        ring: '#06477F',
        online: '#018F3D',
        ai: {
          DEFAULT: '#5B46C8',
          tint: '#F0EDFC',
          foreground: '#FFFFFF',
        },
      },
      fontFamily: {
        display: ['Archivo', 'sans-serif'],
        sans: ['"Inter Tight"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '7px',
        xs: '3px',
        sm: '5px',
        md: '7px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        badge: '4px',
      },
      boxShadow: {
        // A tight, layered elevation scale — never more than one visible shadow
        'hairline': '0 0 0 1px rgba(10, 37, 71, 0.06)',
        'xs': '0 1px 1px rgba(10, 37, 71, 0.05)',
        'card': '0 1px 2px rgba(10, 37, 71, 0.04), 0 1px 1px rgba(10, 37, 71, 0.03)',
        'raised': '0 1px 2px rgba(10, 37, 71, 0.05), 0 4px 12px -4px rgba(10, 37, 71, 0.10)',
        'popover': '0 8px 28px -6px rgba(10, 37, 71, 0.18), 0 2px 6px rgba(10, 37, 71, 0.06)',
        'modal': '0 24px 64px -12px rgba(10, 37, 71, 0.30), 0 8px 20px -8px rgba(10, 37, 71, 0.14)',
        'inset-line': 'inset 0 -1px 0 rgba(10, 37, 71, 0.06)',
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
          '0%': { boxShadow: '0 0 0 0 rgba(1, 143, 61, 0.55)' },
          '70%': { boxShadow: '0 0 0 5px rgba(1, 143, 61, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(1, 143, 61, 0)' },
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
