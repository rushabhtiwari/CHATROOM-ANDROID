// Notifications live here, as a half-page popover off the topbar bell — they are not a
// destination of their own. Anchored under the bell, scrim behind, Escape closes.
//
// The list is a ruled register: a hairline between entries, no zebra, no tinted rows. An
// unread entry is marked the way a clerk marks one — an orange rule down its left edge
// and the word "New" — never by washing the whole row in colour.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCheck, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { useApp } from '@/context/AppContext';
import type { Notification } from '@/lib/types';
import { ROLE_LABEL, TONE_CLASSES } from '@/lib/status';
import type { StatusTone } from '@/lib/status';
import { DEMO_TODAY, cx, formatDateTime, formatRelative } from '@/lib/format';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Derives a visual tone from the notification copy — the seed data has no tone field. */
function toneFor(n: Notification): { tone: StatusTone; Icon: LucideIcon } {
  const text = `${n.title} ${n.body}`.toLowerCase();
  if (text.includes('reject') || text.includes('failed')) return { tone: 'red', Icon: XCircle };
  if (text.includes('credited') || text.includes('approved') || text.includes('paid'))
    return { tone: 'green', Icon: CheckCircle2 };
  if (text.includes('information') || text.includes('overdue') || text.includes('duplicate'))
    return { tone: 'amber', Icon: AlertTriangle };
  return { tone: 'blue', Icon: Info };
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  // Notifications raised at runtime carry the real clock, which can run ahead of the
  // fixed demo date — anything from the demo day onward belongs under "Today".
  return d.toDateString() === DEMO_TODAY.toDateString() || d.getTime() >= DEMO_TODAY.getTime();
}

export function NotificationPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const navigate = useNavigate();
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadCount } = useApp();
  const [tab, setTab] = useState('all');
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // The panel is `aria-modal`, which tells assistive tech to ignore the page behind it —
  // so focus has to come in with it, stay inside it, and go back to the bell on close.
  // Same three moves as Modal and Drawer, and the same focusable query.
  useEffect(() => {
    if (!open) return undefined;
    const returnTo = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onTab);
    return () => {
      document.removeEventListener('keydown', onTab);
      returnTo?.focus?.();
    };
  }, [open]);

  const filtered = useMemo(
    () =>
      notifications
        .filter((n) => (tab === 'unread' ? !n.read : true))
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [notifications, tab],
  );

  const groups = useMemo(
    () => [
      { key: 'today', label: 'Today', items: filtered.filter((n) => isToday(n.at)) },
      { key: 'earlier', label: 'Earlier', items: filtered.filter((n) => !isToday(n.at)) },
    ],
    [filtered],
  );

  if (!open) return null;

  const openRequest = (n: Notification) => {
    markNotificationRead(n.id);
    if (n.requestId) {
      onClose();
      navigate(`/requests/${n.requestId}`);
    }
  };

  return (
    <>
      {/* Scrim — clicking anywhere outside dismisses. */}
      <button
        type="button"
        aria-label="Close notifications"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-rich-black/20"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        // Half a page: 50vh tall, anchored under the topbar on the right. The 3px navy
        // top rule is the same docket head every sheet in the product carries.
        className="ku-sheet fixed right-3 top-[4.25rem] z-50 flex h-[50vh] w-[440px] max-w-[calc(100vw-1.5rem)] flex-col animate-fade-rise focus:outline-none lg:right-6"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div className="min-w-0">
            <h2 className="ku-wide font-display text-lead font-semibold leading-tight text-rich-black">
              Notifications
            </h2>
            <p className="mt-0.5 text-caption text-meta">
              {unreadCount > 0 ? (
                <>
                  <span className="ku-fig font-semibold text-rich-black">{unreadCount}</span>{' '}
                  waiting on you
                </>
              ) : (
                'Nothing new since your last visit'
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={CheckCheck}
              onClick={markAllNotificationsRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </Button>
            <IconButton
              icon={X}
              label="Close notifications"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </div>
        </div>

        <div className="shrink-0 px-4">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'all', label: 'All', count: notifications.length },
              { key: 'unread', label: 'Unread', count: unreadCount },
            ]}
          />
        </div>

        <div className="ku-scrollbar min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              compact
              title={tab === 'unread' ? 'No unread notices' : 'The register is empty'}
              description={
                tab === 'unread'
                  ? 'Every notice here has been read.'
                  : 'Approvals, rejections and payout confirmations land here as they happen.'
              }
            />
          ) : (
            groups
              .filter((g) => g.items.length > 0)
              .map((group) => (
                <section key={group.key} className="border-t border-hairline first:border-t-0">
                  <h3 className="ku-eyebrow sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-hairline bg-canvas px-4 py-2">
                    <span>{group.label}</span>
                    <span className="ku-fig text-micro font-semibold">{group.items.length}</span>
                  </h3>
                  <ul className="ku-ruled">
                    {group.items.map((n) => {
                      const { tone, Icon } = toneFor(n);
                      const classes = TONE_CLASSES[tone];
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => openRequest(n)}
                            className={cx(
                              'flex w-full items-start gap-3 border-l-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas',
                              n.read ? 'border-l-transparent' : 'border-l-orangy',
                            )}
                          >
                            <Icon
                              aria-hidden="true"
                              className={cx('mt-0.5 h-4 w-4 shrink-0', classes.text)}
                            />

                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-2">
                                <span className="min-w-0 flex-1 text-body-s font-semibold leading-5 text-rich-black">
                                  {n.title}
                                </span>
                                {!n.read && (
                                  <span className="ku-eyebrow shrink-0 text-rich-black">New</span>
                                )}
                              </span>
                              <span className="mt-1 block text-caption leading-5 text-meta">
                                {n.body}
                              </span>
                              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-meta">
                                <span>{ROLE_LABEL[n.toRole]}</span>
                                <span aria-hidden="true" className="text-hairline-strong">
                                  ·
                                </span>
                                <span className="ku-fig" title={formatDateTime(n.at)}>
                                  {formatRelative(n.at)}
                                </span>
                                {n.requestId && (
                                  <span className="ku-docket ml-auto">{n.requestId}</span>
                                )}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
          )}
        </div>
      </div>
    </>
  );
}
