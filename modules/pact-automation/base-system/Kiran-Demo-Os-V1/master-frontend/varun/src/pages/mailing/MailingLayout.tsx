import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { MailingControlDeck } from '../../components/mailing/MailingControlDeck';
import { useMailingSummary } from '../../modules/mailing/useMailing';

const TABS = [
  { to: '/admin/mailing/inbox', label: 'Mails' },
  { to: '/admin/mailing/on-hold', label: 'On Hold' },
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
        title="Mailing Hub"
        eyebrow="Intake & communication"
        description="Inbound order mail, document triage, quarantine resolution and pipeline telemetry — the whole intake path in one place."
        actions={
          <span className="ku-stamp border-st-grey-ink text-st-grey-ink">
            {connected ? 'Live' : 'Reconnecting'}
          </span>
        }
      />

      {error && (
        <div className="border border-l-3 border-hairline border-l-st-red-ink bg-st-red-bg px-4 py-2.5 text-body-s text-st-red-ink">
          {error}
        </div>
      )}

      {/* The four numbers the hub is judged on. One ruled band, one tone —
          only the on-hold count earns a second colour, because it is the only
          one an operator is expected to act on. */}
      <LedgerBand cols={4}>
        <KPICard
          title="Messages on file"
          value={summary ? summary.totalMails.toLocaleString() : '—'}
          subtitle={
            summary ? `${summary.inboundCount} in · ${summary.outboundCount} out` : 'Loading'
          }
        />
        <KPICard
          title="On hold"
          value={summary ? summary.onHoldCount.toLocaleString() : '—'}
          tone={summary && summary.onHoldCount > 0 ? 'amber' : undefined}
          subtitle={
            onHold
              ? `${onHold.INTAKE_FILTERED} filtered · ${onHold.EXCEPTION} exceptions · ${onHold.AWAITING_ADMIN ?? 0} admin · ${onHold.AWAITING_ACCOUNTS ?? 0} accounts`
              : 'Loading'
          }
        />
        <KPICard
          title="Straight-through rate"
          value={summary ? `${(summary.stpRate * 100).toFixed(1)}%` : '—'}
          subtitle="Committed without human triage"
        />
        <KPICard
          title="Committed orders"
          value={summary ? summary.committedCount.toLocaleString() : '—'}
          subtitle="On the canonical ledger"
        />
      </LedgerBand>

      <MailingControlDeck summary={summary} connected={connected} onChanged={refresh} />

      {/* The active tab's 2px accent rule sits on the container hairline, so
          the two read as one continuous line. */}
      <div role="tablist" aria-label="Mailing sections" className="ku-scrollbar flex overflow-x-auto border-b border-hairline">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            role="tab"
            className={({ isActive }) =>
              `-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-body-s transition-colors duration-150 ${
                isActive
                  ? 'border-accent font-semibold text-ink'
                  : 'border-transparent text-meta hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span>{tab.label}</span>
                {tab.label === 'On Hold' && summary && summary.onHoldCount > 0 && (
                  <span
                    className={`tnum px-2 py-0.5 font-mono text-caption font-semibold ${
                      isActive ? 'bg-accent text-accent-ink' : 'bg-canvas text-meta'
                    }`}
                  >
                    {summary.onHoldCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
};
