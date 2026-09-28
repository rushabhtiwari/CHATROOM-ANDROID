import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, MessageSquare, Package, Truck, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChat } from '@/lib/chat-store';
import { tap } from '~/native/haptics';

const TABS = [
  { to: '/chats', label: 'Chats', Icon: MessageSquare },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/orders', label: 'Orders', Icon: Package },
  { to: '/dispatches', label: 'Dispatches', Icon: Truck },
  { to: '/me', label: 'Me', Icon: User },
] as const;

/**
 * The unread count across every room the user can see.
 *
 * Read from the chat store rather than kept separately, so the badge cannot
 * disagree with the list it summarises.
 */
function useTotalUnread(): number {
  const { visibleRooms, unreadFor } = useChat();
  return visibleRooms.reduce((total, room) => total + (unreadFor(room.id)?.total ?? 0), 0);
}

export function TabBar() {
  const unread = useTotalUnread();
  const { pathname } = useLocation();

  // A conversation takes the whole screen: the composer sits where the tab bar
  // would be, and a tab bar above the keyboard is nobody's idea of a chat app.
  // The same goes for the screens a conversation leads to: profiles, saved
  // messages, a new chat.
  const hidden = /^\/(chats\/[^/]+|people\/|saved)/.test(pathname);
  if (hidden) return null;

  return (
    <nav
      className="absolute inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-safe-bottom backdrop-blur"
      aria-label="Sections"
    >
      <ul className="flex h-tabbar items-stretch">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              onClick={() => tap()}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-0.5',
                  isActive ? 'text-brand' : 'text-slate-500',
                )
              }
            >
              <span className="relative">
                <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
                {to === '/chats' && unread > 0 && (
                  <span
                    className="absolute -right-2.5 -top-1.5 min-w-[17px] rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-[17px] text-white"
                    aria-label={`${unread} unread`}
                  >
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
