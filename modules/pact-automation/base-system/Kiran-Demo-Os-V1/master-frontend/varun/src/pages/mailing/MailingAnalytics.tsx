import React, { useCallback, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { mailingApi } from '../../modules/mailing/api';
import { useAsync, useMailingVersion } from '../../modules/mailing/useMailing';
import { KPICard, LedgerBand } from '../../components/common/KPICard';

// The console's ledger palette. Charts spend the same two brand colours as the
// rest of the page — structure for the settled series, accent for the one the
// reader is meant to act on — with the status inks reserved for exceptions.
const INK = {
  structure: '#02223C',
  accent: '#E99741',
  red: '#A11020',
  meta: '#5C6975',
  hairline: '#D2D9DF',
};

const AXIS = { fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', fill: INK.meta };

/**
 * "The Analytics Part" (WORKING.md §3.4).
 *
 * Straight-through rate, intake volume over time, exception Pareto, sender
 * leaders and SLA compliance. Every figure is computed from the ledger on read,
 * so a chart can never disagree with the table an operator just looked at.
 */
export const MailingAnalytics: React.FC = () => {
  const version = useMailingVersion();
  const [days, setDays] = useState(14);

  const load = useCallback(() => mailingApi.analytics(days), [days]);
  const { data, error } = useAsync(load, [days, version]);

  if (error) {
    return (
      <div className="border border-l-3 border-hairline border-l-st-red-ink bg-st-red-bg px-4 py-2.5 text-body-s text-st-red-ink">
        {error}
      </div>
    );
  }

  const minutes = (value: number | null) => (value === null ? '—' : `${value.toFixed(0)}m`);

  return (
    <div className="space-y-6">
      {/* ---- Headline figures ---------------------------------------- */}
      <LedgerBand cols={4}>
        <KPICard
          title="Straight-through rate"
          value={data ? `${(data.stp.rate * 100).toFixed(1)}%` : '—'}
          subtitle={
            data
              ? `${data.stp.straightThrough} of ${data.stp.decided} decided without a human`
              : 'Loading'
          }
        />
        <KPICard
          title="Turnaround p90"
          value={data ? minutes(data.latency.p90) : '—'}
          subtitle={data ? `p50 ${minutes(data.latency.p50)} · p99 ${minutes(data.latency.p99)}` : ''}
        />
        <KPICard
          title="ACK SLA compliance"
          value={data ? `${(data.sla.compliance * 100).toFixed(0)}%` : '—'}
          tone={data && data.sla.breached > 0 ? 'amber' : undefined}
          subtitle={
            data
              ? `${data.sla.breached} breach(es) against a ${data.sla.targetMinutes}-minute target`
              : ''
          }
        />
        <KPICard
          title="Exceptions raised"
          value={data ? data.intake.exceptions.toLocaleString() : '—'}
          tone={data && data.intake.exceptions > 0 ? 'red' : undefined}
          subtitle={data ? `${data.intake.notOrders} filtered at intake` : ''}
        />
      </LedgerBand>

      {/* ---- Intake volume ------------------------------------------- */}
      <section className="ku-sheet">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <p className="ku-eyebrow">Intake velocity</p>
            <h2 className="ku-wide mt-1.5 font-display text-h3 font-semibold text-ink">
              What arrived, and what it turned into
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {[7, 14, 30].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                aria-pressed={days === option}
                className={`border-2 px-2.5 py-1 text-caption font-semibold leading-none transition-all duration-150 active:translate-y-px ${
                  days === option
                    ? 'border-ink bg-accent text-accent-ink'
                    : 'border-hairline-strong bg-white text-ink hover:border-ink hover:bg-canvas'
                }`}
              >
                {option}d
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-4" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.timeseries ?? []} barGap={2}>
              <CartesianGrid stroke={INK.hairline} vertical={false} />
              <XAxis
                dataKey="date"
                tick={AXIS}
                tickLine={false}
                axisLine={{ stroke: INK.hairline }}
                tickFormatter={(value: string) => value.slice(5)}
              />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  border: `1px solid ${INK.hairline}`,
                  borderRadius: 0,
                  fontSize: 12,
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="orders" name="Orders" fill={INK.structure} />
              <Bar dataKey="exceptions" name="Exceptions" fill={INK.red} />
              <Bar dataKey="notOrders" name="Filtered" fill={INK.hairline} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ---- Exception Pareto -------------------------------------- */}
        <section className="ku-card">
          <div className="border-b border-hairline px-5 py-4">
            <p className="ku-eyebrow">Root cause</p>
            <h2 className="ku-wide mt-1.5 font-display text-h3 font-semibold text-ink">
              What puts messages on hold
            </h2>
            <p className="mt-1.5 text-body-s text-meta">
              Ordered by frequency, with the cumulative share — the few causes worth fixing sit to
              the left of the knee.
            </p>
          </div>

          <div className="px-5 py-4" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data?.errorBreakdown ?? []}>
                <CartesianGrid stroke={INK.hairline} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ ...AXIS, fontSize: 9 }}
                  tickLine={false}
                  axisLine={{ stroke: INK.hairline }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={70}
                />
                <YAxis yAxisId="count" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  yAxisId="share"
                  orientation="right"
                  domain={[0, 1]}
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={{
                    border: `1px solid ${INK.hairline}`,
                    borderRadius: 0,
                    fontSize: 12,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                  formatter={(value: number, name: string) =>
                    name === 'Cumulative' ? `${(value * 100).toFixed(0)}%` : value
                  }
                />
                <Bar yAxisId="count" dataKey="count" name="Held" fill={INK.structure} />
                <Line
                  yAxisId="share"
                  type="monotone"
                  dataKey="cumulativeShare"
                  name="Cumulative"
                  stroke={INK.accent}
                  strokeWidth={2}
                  dot={{ r: 3, fill: INK.accent }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ---- Sender leaders ---------------------------------------- */}
        <section className="ku-card flex flex-col">
          <div className="border-b border-hairline px-5 py-4">
            <p className="ku-eyebrow">Sender volume</p>
            <h2 className="ku-wide mt-1.5 font-display text-h3 font-semibold text-ink">
              Who sends the traffic
            </h2>
          </div>

          <div className="ku-scrollbar min-h-0 flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-body-s">
              <thead>
                <tr>
                  {['Domain', 'Total', 'Committed', 'Held', 'Hold rate'].map((heading, index) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`ku-narrow sticky top-0 z-10 bg-white px-4 py-2.5 align-bottom text-micro font-semibold uppercase text-meta after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-structure after:content-[''] ${
                        index === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.domainStats ?? []).map((row) => (
                  <tr
                    key={row.domain}
                    className="border-b border-hairline border-l-3 border-l-transparent bg-white transition-colors duration-150 last:border-b-0 hover:border-l-accent hover:bg-canvas"
                  >
                    <td className="px-4 py-2.5">
                      <span className="ku-fig text-ink">{row.domain}</span>
                      {!row.known && (
                        <span className="ku-stamp ml-2 border-st-grey-ink text-st-grey-ink">
                          not whitelisted
                        </span>
                      )}
                    </td>
                    <td className="ku-fig px-4 py-2.5 text-right text-ink">{row.total}</td>
                    <td className="ku-fig px-4 py-2.5 text-right text-ink">{row.committed}</td>
                    <td className="ku-fig px-4 py-2.5 text-right text-ink">{row.held}</td>
                    <td
                      className={`ku-fig px-4 py-2.5 text-right font-semibold ${
                        row.errorRate > 0.5 ? 'text-st-red-ink' : 'text-ink'
                      }`}
                    >
                      {(row.errorRate * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
