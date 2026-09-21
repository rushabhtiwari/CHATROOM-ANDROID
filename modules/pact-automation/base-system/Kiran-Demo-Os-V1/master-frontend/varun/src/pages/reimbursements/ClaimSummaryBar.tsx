/**
 * The four numbers a finance lead checks first.
 *
 * Deliberately four, and deliberately not a dashboard. Money in flight, money
 * waiting on a person, the oldest thing that has not moved, and what has
 * actually left the bank this month. Anything else is a question for the
 * table underneath.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Banknote, Clock, Wallet } from 'lucide-react';
import { useRts } from '@/modules/rts/store';
import { formatCompactCurrency, daysUntil } from '@/modules/rts/format';
import { actionOwner, isTerminal } from '@/modules/rts/status';

export const ClaimSummaryBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { requests, payouts } = useRts();

  const stats = useMemo(() => {
    const open = requests.filter((request) => !isTerminal(request.status));
    const inFlight = open.reduce((total, request) => total + request.amount, 0);

    const awaitingPeople = requests.filter((request) => {
      const owner = actionOwner(request.status);
      return owner === 'HR' || owner === 'ACCOUNTS';
    });
    const awaiting = awaitingPeople.reduce((total, request) => total + request.amount, 0);

    // The oldest thing still waiting on a human, in days.
    const oldest = awaitingPeople.reduce((worst, request) => {
      const age = -daysUntil(request.submittedOn);
      return age > worst ? age : worst;
    }, 0);

    const settled = payouts
      .filter((payout) => payout.status === 'PAID')
      .reduce((total, payout) => total + payout.amount, 0);

    return {
      inFlight,
      inFlightCount: open.length,
      awaiting,
      awaitingCount: awaitingPeople.length,
      oldest: Math.max(0, Math.round(oldest)),
      settled,
      settledCount: payouts.filter((payout) => payout.status === 'PAID').length,
    };
  }, [requests, payouts]);

  const tiles = [
    {
      label: 'In flight',
      value: formatCompactCurrency(stats.inFlight),
      detail: `${stats.inFlightCount} open claim${stats.inFlightCount === 1 ? '' : 's'}`,
      icon: Wallet,
      accent: 'text-kiran',
      tint: 'bg-kiran-tint',
    },
    {
      label: 'Waiting on a reviewer',
      value: formatCompactCurrency(stats.awaiting),
      detail: `${stats.awaitingCount} with HR or Accounts`,
      icon: Clock,
      accent: 'text-strand-amber',
      tint: 'bg-strand-amber/10',
    },
    {
      label: 'Oldest unactioned',
      value: stats.oldest === 0 ? '—' : `${stats.oldest}d`,
      detail: stats.oldest > 5 ? 'Past the review window' : 'Within the review window',
      icon: AlertTriangle,
      accent: stats.oldest > 5 ? 'text-strand-red' : 'text-slate-600',
      tint: stats.oldest > 5 ? 'bg-strand-red/8' : 'bg-slate-100',
    },
    {
      label: 'Disbursed',
      value: formatCompactCurrency(stats.settled),
      detail: `${stats.settledCount} payout${stats.settledCount === 1 ? '' : 's'} settled`,
      icon: Banknote,
      accent: 'text-strand-green',
      tint: 'bg-strand-green/10',
    },
  ];

  return (
    <div className={`ku-ledger grid-cols-2 lg:grid-cols-4 ${className}`}>
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div key={tile.label} className="panel px-4 py-3.5">
            <div className="flex items-start justify-between gap-2">
              <span className="label-eyebrow">{tile.label}</span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tile.tint} ${tile.accent}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 font-mono text-[22px] font-semibold leading-none tracking-tight text-ink">
              {tile.value}
            </div>
            <p className="mt-1.5 text-[12px] text-muted">{tile.detail}</p>
          </div>
        );
      })}
    </div>
  );
};

export default ClaimSummaryBar;
