import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { usePipelineSummary } from '../../modules/pipeline/usePipeline';

const TABS = [
  { to: '/admin/automation/orders', label: 'Orders' },
  { to: '/admin/automation/kpac', label: 'KPAC & PACT' },
  { to: '/admin/automation/rules', label: 'Rules' },
];

/**
 * The Order Automation shell.
 *
 * Built as the Mailing Hub's sibling and to the same rules: the page spine, the four
 * headline figures in one ruled band, and a tab strip whose sub-sections render into the
 * outlet — so an operator never loses the KPAC status while working an order.
 *
 * The four numbers were chosen to answer the four questions a presenter is actually
 * asked, in order:
 *
 *   "how many orders are in this?"          → Orders in flight
 *   "what is it waiting for?"               → Awaiting the customer
 *   "does the robot really write to PACT?"  → PACT drafts
 *   "and does it bill?"                     → Demo proformas
 *
 * Only "awaiting the customer" earns a second colour, because it is the only one an
 * operator is expected to act on — and acting on it means asking the customer, not
 * answering for them.
 */
export const AutomationLayout: React.FC = () => {
  const { summary, error } = usePipelineSummary();
  const kpac = summary?.kpac;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Automation"
        eyebrow="Purchase orders end to end"
        description="A customer's purchase order from the inbox to a PACT draft: receipt, internal notification, the customer's own confirmation, and a demonstration proforma. Only the customer's approval commits anything."
        actions={
          <span
            className={`ku-stamp ${
              kpac?.reachable
                ? 'border-st-green-ink text-st-green-ink'
                : 'border-st-red-ink text-st-red-ink'
            }`}
          >
            {kpac?.reachable ? `KPAC ${kpac.mode ?? 'up'}` : 'KPAC offline'}
          </span>
        }
      />

      {error && (
        <div className="rounded-md bg-st-red-bg px-4 py-2.5 text-body-s text-st-red-ink">
          {error}
        </div>
      )}

      {/* A profile mismatch is the one condition that would fill the wrong PACT document
          in front of a client, so it is a banner rather than a field on a panel. */}
      {kpac?.reachable && kpac.profileMatches === false && (
        <div className="rounded-md bg-st-red-bg px-4 py-2.5 text-body-s text-ink">
          KPAC has <span className="ku-fig font-semibold">{kpac.profile}</span> loaded, but this
          console expects <span className="ku-fig font-semibold">{summary?.kpacProfile}</span>.
          Filling the wrong PACT screen is not something to guess at — nothing will be pushed
          until they match.
        </div>
      )}

      <LedgerBand cols={4}>
        <KPICard
          title="Awaiting an admin"
          value={summary ? summary.awaitingAdmin.toLocaleString() : '—'}
          tone={summary && summary.awaitingAdmin > 0 ? 'amber' : undefined}
          subtitle="No work starts until somebody approves"
        />
        <KPICard
          title="Releasing into PACT"
          value={summary ? summary.awaitingAccounts.toLocaleString() : '—'}
          tone={summary && summary.awaitingAccounts > 0 ? 'amber' : undefined}
          subtitle="Approved, being typed into PACT"
        />
        <KPICard
          title="PACT drafts"
          value={summary ? summary.pactDrafts.toLocaleString() : '—'}
          subtitle={
            summary
              ? `Save Draft only · ${summary.pactPaused} paused · ${summary.pactFailed} failed`
              : 'Loading'
          }
        />
        <KPICard
          title="Demo proformas"
          value={summary ? summary.proformas.toLocaleString() : '—'}
          subtitle="Never a tax invoice"
        />
      </LedgerBand>

      <div
        role="tablist"
        aria-label="Automation sections"
        className="ku-scrollbar flex overflow-x-auto border-b border-hairline"
      >
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
                {tab.label === 'Orders' &&
                  summary &&
                  summary.awaitingAdmin + summary.awaitingAccounts > 0 && (
                  <span
                    className={`tnum px-2 py-0.5 font-mono text-caption font-semibold ${
                      isActive ? 'bg-accent text-white' : 'bg-canvas text-meta'
                    }`}
                  >
                      {summary.awaitingAdmin + summary.awaitingAccounts}
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
