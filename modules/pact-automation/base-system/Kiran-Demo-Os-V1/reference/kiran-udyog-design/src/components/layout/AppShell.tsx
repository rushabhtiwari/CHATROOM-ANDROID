// The persistent chrome: navy rail + white utility bar + scrolling content well.
// Used directly as a route element, so it takes no props and renders an <Outlet />.
//
// The well is 1600px at its widest, so the gutters step up with the viewport rather
// than staying at a single value — generous at the top of the sheet, deeper at the
// foot so the last row of a long ledger never sits on the edge of the window.

import { Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { RouteProgress } from '@/components/layout/RouteProgress';
import { PageLoader } from '@/components/ui/PageLoader';

/**
 * Renders only once the lazily-loaded route has actually resolved (it lives inside
 * <Suspense>), so mounting it is a reliable "the page has arrived" signal.
 */
function RouteReady({ onReady }: { onReady: () => void }): null {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export function AppShell(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const location = useLocation();

  // Navigating always dismisses the off-canvas drawer and starts the progress bar.
  useEffect(() => {
    setMobileOpen(false);
    setPending(true);
  }, [location.pathname]);

  const handleReady = useCallback(() => setPending(false), []);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/*
        The rail is fourteen links deep and it is repeated on every screen, so there has
        to be a way past it. Invisible until it takes focus, then it lands as an orange
        tab in the top-left corner — rich-black on orangy, the one legible pairing.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:border-2 focus:border-rich-black focus:bg-orangy focus:px-4 focus:py-2 focus:text-body-s focus:font-semibold focus:text-rich-black"
      >
        Skip to content
      </a>

      <RouteProgress active={pending} />

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onToggleSidebar={() => setMobileOpen((value) => !value)} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto ku-scrollbar">
          <div className="mx-auto w-full max-w-shell px-5 pb-16 pt-6 sm:px-7 lg:px-10 lg:pb-20 lg:pt-8 xl:px-14">
            <Suspense fallback={<PageLoader />}>
              {/* Keyed on the path so each route animates in as its own element. */}
              <div key={location.pathname} className="animate-page-in">
                <RouteReady onReady={handleReady} />
                <Outlet />
              </div>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
