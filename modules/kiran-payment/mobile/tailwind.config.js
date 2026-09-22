import consoleConfig from 'kiran-os/tailwind.config.js';

/**
 * The console's design system, unchanged, plus this app's own source.
 *
 * Extending rather than copying means the brand palette, the Geist stack and
 * the radius and shadow scales stay defined in exactly one place. The only
 * thing that differs is `content`: Tailwind has to scan both this package and
 * the console's source, because shared components (ClaimCard, the markdown
 * renderer) carry class names that this app's build must generate.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  ...consoleConfig,
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../master-frontend/vd/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    ...consoleConfig.theme,
    extend: {
      ...consoleConfig.theme.extend,
      spacing: {
        ...consoleConfig.theme.extend?.spacing,
        // The notch, the home indicator and the rounded corners. Every screen
        // pads against these rather than guessing at a device.
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        // The bottom tab bar's height, so scroll containers can clear it.
        'tabbar': '56px',
      },
      minHeight: {
        // Apple's minimum comfortable target. Every tappable row meets it.
        'touch': '44px',
      },
      keyframes: {
        ...consoleConfig.theme.extend?.keyframes,
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        ...consoleConfig.theme.extend?.animation,
        'sheet-up': 'sheet-up 260ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
};
