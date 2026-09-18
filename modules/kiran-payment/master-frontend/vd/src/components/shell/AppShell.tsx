import React, { useState } from 'react';
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

const isFullBleed = (pathname: string) =>
  FULL_BLEED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const location = useLocation();
  const fullBleed = isFullBleed(location.pathname);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink antialiased">
      {/* Sidebar Rail */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Sticky TopBar */}
        <TopBar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />

        {fullBleed ? (
          <main className="flex-1 min-h-0 overflow-hidden">{children || <Outlet />}</main>
        ) : (
          <main className="flex-1 overflow-y-auto min-h-0">
            <div
              key={location.pathname}
              className="max-w-[1680px] mx-auto px-8 py-7 animate-page-enter"
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
