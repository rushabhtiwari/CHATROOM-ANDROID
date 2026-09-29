/**
 * Android's back button.
 *
 * Left alone, Capacitor walks the web view's history and ignores what is on
 * screen: with a sheet open, back leaves the whole screen and the sheet goes
 * with it, and on the chat list it walks back into conversations the user
 * already left. Android users press back to dismiss things, and expect the
 * platform's rule for bottom tabs. So, in order:
 *
 *  1. the newest open sheet or viewer closes (or a flow steps back);
 *  2. on Chats, the first tab, the app goes to the background;
 *  3. on any other tab, back goes to Chats;
 *  4. anywhere else it is one step back — or Chats, with nothing behind.
 *
 * iOS has no back button and the web has its own, so this only listens on
 * Android.
 */
import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { isAndroid } from './platform';

/** Open overlays, newest last. */
const open: Array<{ close: () => void }> = [];

/**
 * While mounted, the back button runs `onClose` instead of leaving the screen:
 * closing an overlay, or stepping a multi-step flow back one step. `enabled`
 * lets a flow hand back to ordinary navigation on its first step.
 */
export function useCloseOnBack(onClose: () => void, enabled = true): void {
  // Callers pass inline arrows; the latest one is what should run.
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!enabled) return;
    const entry = { close: () => latest.current() };
    open.push(entry);
    return () => {
      const index = open.indexOf(entry);
      if (index !== -1) open.splice(index, 1);
    };
  }, [enabled]);
}

const HOME = '/chats';
/** The bottom tabs other than Chats. */
const OTHER_TABS = new Set(['/calls', '/calendar', '/orders', '/dispatches', '/me']);

type Navigate = (to: string, options: { replace: boolean }) => void;
let navigateTo: Navigate | null = null;

/** Lets back change tabs through the router. The app registers its `navigate` once. */
export function useBackButtonNavigation(navigate: Navigate): void {
  useEffect(() => {
    navigateTo = navigate;
    return () => {
      if (navigateTo === navigate) navigateTo = null;
    };
  }, [navigate]);
}

/** One press of back. Separate from the listener so it can be tested on the web. */
export function handleBack(
  canGoBack: boolean,
  path: string = window.location.pathname,
): 'closed' | 'back' | 'home' | 'background' {
  const top = open[open.length - 1];
  if (top) {
    top.close();
    return 'closed';
  }
  if (path !== HOME && navigateTo && (OTHER_TABS.has(path) || !canGoBack)) {
    navigateTo(HOME, { replace: true });
    return 'home';
  }
  if (path !== HOME && canGoBack) {
    window.history.back();
    return 'back';
  }
  void App.minimizeApp();
  return 'background';
}

export function initBackButton(): void {
  if (!isAndroid) return;
  // Adding a listener is what turns Capacitor's own handling off.
  void App.addListener('backButton', ({ canGoBack }) => handleBack(canGoBack));
}
