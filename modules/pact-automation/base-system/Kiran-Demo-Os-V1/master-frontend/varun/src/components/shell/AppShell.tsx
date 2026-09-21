import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';

interface AppShellProps {
  children?: React.ReactNode;
}

/**
 * Routes that own their own scrolling and need the full viewport.
 *
 * The console's default page container is a centred, padded column, which is
 * right for a report and wrong for a conversation: a chat has its own rail,
 * its own scroll region and a composer pinned to the bottom edge. These routes
 * are handed the bare content area instead.
 */
const FULL_BLEED = ['/chat'];

/**
 * Routes whose *children* are full-bleed but whose index is not.
 *
 * `/projects` is a grid of cards and reads correctly in the centred column.
 * Everything below it is a dense workspace with its own toolbar, its own scroll
 * region and a peek panel that slides over it — none of which survive being put
 * inside a padded, page-scrolling container.
 */
const FULL_BLEED_CHILDREN = ['/projects'];

const isFullBleed = (pathname: string) =>
  FULL_BLEED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
  FULL_BLEED_CHILDREN.some((prefix) => pathname.startsWith(`${prefix}/`));

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const fullBleed = isFullBleed(location.pathname);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((isOpen) => !isOpen);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink antialiased">
      {/* Sidebar Rail */}
      <Sidebar
        mobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Sticky TopBar */}
        <TopBar
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {fullBleed ? (
          <main className="flex-1 min-h-0 overflow-hidden">{children || <Outlet />}</main>
        ) : (
          <main className="ku-scrollbar flex-1 overflow-y-auto min-h-0">
            {/* §6 The content well. Bottom padding is deliberately larger than
                top, so the last row of a long ledger never sits on the window
                edge; gutters step up with the viewport. */}
            <div
              key={location.pathname}
              className="mx-auto w-full max-w-shell px-4 pb-16 pt-6 sm:px-8 sm:pt-8 animate-page-enter"
            >
              {children || <Outlet />}
            </div>
          </main>
        )}
      </div>

      {/* Global ⌘K Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};
