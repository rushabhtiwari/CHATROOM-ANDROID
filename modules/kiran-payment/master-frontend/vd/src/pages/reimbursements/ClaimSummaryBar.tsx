/**
 * The four numbers a finance lead checks first.
 *
 * Deliberately four, and deliberately not a dashboard. Money in flight, money
 * waiting on a person, the oldest thing that has not moved, and what has
 * actually left the bank this month. Anything else is a question for the
 * table underneath.
 */

import React, { useMemo } from 'react';
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
    { label: 'Open', value: formatCompactCurrency(stats.inFlight), alert: false },
    { label: 'In review', value: formatCompactCurrency(stats.awaiting), alert: false },
    {
      label: 'Oldest waiting',
      value: stats.oldest === 0 ? '—' : `${stats.oldest} days`,
      alert: stats.oldest > 5,
    },
    { label: 'Paid', value: formatCompactCurrency(stats.settled), alert: false },
  ];

  return (
    <div className={`grid grid-cols-2 gap-4 lg:grid-cols-4 ${className}`}>
      {tiles.map((tile) => (
        <div key={tile.label} className="kpi">
          <div className="kpi-label">{tile.label}</div>
          <div className={`kpi-value ${tile.alert ? 'text-strand-red' : ''}`}>{tile.value}</div>
        </div>
      ))}
    </div>
  );
};

export default ClaimSummaryBar;
