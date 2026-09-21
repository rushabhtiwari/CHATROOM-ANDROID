import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { MailingControlDeck } from '../../components/mailing/MailingControlDeck';
import { useMailingSummary } from '../../modules/mailing/useMailing';

const TABS = [
  { to: '/admin/mailing/inbox', label: 'Mails' },
  { to: '/admin/mailing/on-hold', label: 'On hold' },
  { to: '/admin/mailing/analytics', label: 'Analytics' },
];

/**
 * The Mailing Hub shell (WORKING.md §2).
 *
 * Everything persistent across the three sub-routes lives here: the page spine,
 * the four headline figures, the control deck, and the tab strip. The
 * sub-sections render into the outlet below it, so an operator never loses the
 * watcher status or the on-hold count while working a queue.
 */
export const MailingLayout: React.FC = () => {
  const { summary, connected, error, refresh } = useMailingSummary();

  const onHold = summary?.onHoldByReason;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mail"
        badge={
          !connected ? (
            <span className="ku-stamp text-st-amber-ink">Reconnecting</span>
          ) : undefined
        }
      />

      {error && (
        <div className="rounded-md bg-st-red-bg px-4 py-3 text-body-s text-st-red-ink">{error}</div>
      )}

      <LedgerBand cols={4}>
        <KPICard title="Mails" value={summary ? summary.totalMails.toLocaleString() : '—'} />
        <KPICard
          title="On hold"
          value={summary ? summary.onHoldCount.toLocaleString() : '—'}
          tone={summary && summary.onHoldCount > 0 ? 'amber' : undefined}
        />
        <KPICard
          title="Auto-processed"
          value={summary ? `${(summary.stpRate * 100).toFixed(1)}%` : '—'}
        />
        <KPICard
          title="Orders created"
          value={summary ? summary.committedCount.toLocaleString() : '—'}
        />
      </LedgerBand>

      <MailingControlDeck summary={summary} connected={connected} onChanged={refresh} />

      <div
        role="tablist"
        aria-label="Mailing sections"
        className="ku-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-[#EBEBEF] p-0.5"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            role="tab"
            className={({ isActive }) =>
              `flex h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-sm px-3.5 text-caption font-medium transition-colors duration-150 ${
                isActive ? 'bg-white text-ink' : 'text-meta hover:text-ink'
              }`
            }
          >
            <span>{tab.label}</span>
            {tab.to.endsWith('/on-hold') && summary && summary.onHoldCount > 0 && (
              <span className="tnum text-faint">{summary.onHoldCount}</span>
            )}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
};
