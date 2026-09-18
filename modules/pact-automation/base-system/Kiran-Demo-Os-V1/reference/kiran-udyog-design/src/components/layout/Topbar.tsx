// White utility bar. It is the most valuable band on the screen, so it states the two
// facts that frame everything below it — the desk you are sitting at and the period the
// books are open on — and then carries the notification bell and the signed-in user.

import { useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/Button';
import { NotificationPanel } from '@/components/layout/NotificationPanel';
import { useApp } from '@/context/AppContext';
import { DEMO_TODAY, formatDate } from '@/lib/format';

export interface TopbarProps {
  onToggleSidebar: () => void;
}

/**
 * The month the ledger is open on. Derived from the one demo clock and run through
 * `formatDate` so the month spelling matches every other date in the product.
 */
const LEDGER_PERIOD = formatDate(DEMO_TODAY).replace(/^\d+\s/, '');
const LEDGER_OPEN_ON = `Books open on ${formatDate(DEMO_TODAY)}`;

export function Topbar({ onToggleSidebar }: TopbarProps): JSX.Element {
  const { currentEmployee, unreadCount } = useApp();
  const [bellOpen, setBellOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-hairline bg-white px-4 lg:px-6">
      <IconButton
        icon={Menu}
        label="Open navigation"
        variant="ghost"
        onClick={onToggleSidebar}
        className="lg:hidden"
      />

      {/* Context rail — quiet, factual, never competing with the page title below. */}
      <div className="hidden min-w-0 items-stretch sm:flex">
        <div className="hidden min-w-0 flex-col justify-center pr-5 lg:flex">
          <span className="ku-eyebrow">Signed in</span>
          <span className="mt-0.5 truncate text-body-s font-semibold text-rich-black">
            {currentEmployee.designation} · {currentEmployee.department}
          </span>
        </div>
        <div className="flex flex-col justify-center border-hairline lg:border-l lg:pl-5">
          <span className="ku-eyebrow">Ledger period</span>
          <span
            title={LEDGER_OPEN_ON}
            className="ku-fig mt-0.5 text-body-s font-semibold text-rich-black"
          >
            {LEDGER_PERIOD}
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 lg:gap-4">
        <div className="relative">
          <IconButton
            icon={Bell}
            label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            variant="ghost"
            onClick={() => setBellOpen((open) => !open)}
          />
          {unreadCount > 0 && (
            // A counted figure, so it is set like one: hard-edged, mono, tabular.
            <span
              aria-hidden="true"
              className="ku-fig pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center bg-orangy px-1 text-micro font-semibold leading-none tracking-normal text-rich-black"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 border-l border-hairline pl-3 lg:pl-4">
          <Avatar name={currentEmployee.name} size="sm" />
          <span className="hidden min-w-0 flex-col leading-tight md:flex">
            <span className="truncate text-body-s font-semibold text-rich-black">
              {currentEmployee.name}
            </span>
            <span className="ku-docket truncate">{currentEmployee.employeeCode}</span>
          </span>
        </div>
      </div>

      <NotificationPanel open={bellOpen} onClose={() => setBellOpen(false)} />
    </header>
  );
}
