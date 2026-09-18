/**
 * Theme.
 *
 * KiranOS ships one appearance. The console's palette is sampled from the
 * company mark and every surface — including this chat module — is tuned
 * against it, so a second, darker interpretation of those colours would be a
 * second design system to keep honest rather than a feature.
 *
 * The hook is kept because components downstream (the emoji picker, most
 * notably) ask what theme they are rendering into. It answers, truthfully,
 * that the answer is always light.
 */

import { useMemo, type ReactNode } from 'react';

export type ThemePreference = 'light';
export type ResolvedTheme = 'light';

interface ThemeValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

const LIGHT: ThemeValue = {
  preference: 'light',
  resolved: 'light',
  setPreference: () => {},
  toggle: () => {},
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useTheme(): ThemeValue {
  return useMemo(() => LIGHT, []);
}
