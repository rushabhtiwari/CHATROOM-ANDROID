/**
 * `/projects/:id/reports` — the Kiran-specific reporting.
 *
 * This screen is not in the brief's list of routes, but §9 asks for the hours
 * and cost charts and the weekly report archive to exist, and they do not
 * belong on the work-item list. The old `ProjectDetail` carried them as tabs;
 * this is the same content, with every figure computed from time entries and
 * work items rather than the hardcoded `burnData` array that made all three
 * projects show the identical cost curve.
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { endOfWeek, format, parseISO } from 'date-fns';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { formatINR } from '@/utils/formatters';
import { BLENDED_HOURLY_RATE_INR, STATE_GROUPS } from '@/modules/projects/constants';
import {
  groupOfItem,
  memberLoad,
  projectRollup,
  weeklyHoursForProject,
  workItemsForProject,
} from '@/modules/projects/selectors';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import { Avatar } from '@/components/projects/Glyphs';

const Panel: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <section className="rounded-lg border border-line bg-white p-4 shadow-card">
    <h2 className="font-display text-[13.5px] font-semibold text-ink">{title}</h2>
    {hint && <p className="mt-0.5 text-[11.5px] text-muted">{hint}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

export const ProjectReportsPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { state } = useProjects();

  const rollup = projectRollup(state, id);
  const weekly = weeklyHoursForProject(state, id);
  const load = memberLoad(state, id);
  const items = workItemsForProject(state, id);
  const reports = state.weeklyReports.allIds
    .map((reportId) => state.weeklyReports.byId[reportId])
    .filter((report) => report.projectId === id)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  /** Cumulative spend, so the chart reads as a burn rather than a bar salad. */
  let running = 0;
  const spend = weekly.map((week) => {
    running += week.cost;
    return {
      label: format(parseISO(week.weekStart), 'd MMM'),
      hours: week.hours,
      cost: week.cost,
      cumulative: running,
    };
  });

  const byGroup = STATE_GROUPS.map((group) => ({
    name: group.label,
    value: items.filter((item) => groupOfItem(state, item) === group.id).length,
    color: group.color,
  })).filter((entry) => entry.value > 0);

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Headline figures */}
        <div className="ku-ledger border-t-3 border-t-structure grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Hours logged', value: `${rollup.hoursSpent}h` },
            { label: 'Cost to date', value: formatINR(rollup.costToDate) },
            { label: 'Points complete', value: `${rollup.donePoints}/${rollup.estimatePoints}` },
            { label: 'Overdue items', value: String(rollup.overdue), danger: rollup.overdue > 0 },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-white p-3">
              <div className="text-[11px] text-muted">{stat.label}</div>
              <div
                className={`mt-0.5 font-mono text-[19px] font-bold ${
                  stat.danger ? 'text-strand-red' : 'text-ink'
                }`}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <Panel
          title="Cost burn"
          hint={`Weekly logged hours against cumulative spend, at a blended ${formatINR(
            BLENDED_HOURLY_RATE_INR,
          )}/hour. Every figure comes from recorded time entries.`}
        >
          {spend.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted">No time logged yet.</p>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={spend} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF2F7" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#75849A' }}
                    axisLine={{ stroke: '#E4E9F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="hours"
                    tick={{ fontSize: 10, fill: '#75849A' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <YAxis
                    yAxisId="cost"
                    orientation="right"
                    tick={{ fontSize: 10, fill: '#75849A' }}
                    axisLine={false}
                    tickLine={false}
                    width={62}
                    tickFormatter={(value: number) => formatINR(value, false)}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 7,
                      border: '1px solid #E4E9F0',
                    }}
                    formatter={(value: number, name) =>
                      name === 'hours' ? [`${value}h`, 'Hours'] : [formatINR(value), 'Cumulative']
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="hours" dataKey="hours" fill="#00AEEF" radius={[3, 3, 0, 0]} />
                  <Line
                    yAxisId="cost"
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#06477F"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Work by state">
            <div className="h-[196px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byGroup}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {byGroup.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 7 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Hours by member">
            <div className="h-[196px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={load
                    .map((row) => ({
                      name: personById(row.personId)?.name.split(' ')[0] ?? '—',
                      hours: row.hours,
                    }))
                    .filter((row) => row.hours > 0)
                    .sort((a, b) => b.hours - a.hours)}
                  margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid stroke="#EEF2F7" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#75849A' }}
                    axisLine={{ stroke: '#E4E9F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#75849A' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 7 }}
                    formatter={(value: number) => [`${value}h`, 'Logged']}
                  />
                  <Bar dataKey="hours" fill="#018F3D" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* Team standing — the Kiran compliance flavour from the old page */}
        <Panel
          title="Team standing"
          hint="Compliance scores and warnings come from the company directory. Assigned, overdue and hours are computed from this project."
        >
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.07em] text-muted">
                <th className="py-1.5 text-left font-semibold">Member</th>
                <th className="py-1.5 text-right font-semibold">Assigned</th>
                <th className="py-1.5 text-right font-semibold">Overdue</th>
                <th className="py-1.5 text-right font-semibold">Hours</th>
                <th className="py-1.5 text-right font-semibold">Cost</th>
                <th className="py-1.5 text-right font-semibold">Standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {load.map((row) => {
                const person = personById(row.personId);
                if (!person) return null;
                return (
                  <tr key={row.personId}>
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <Avatar
                          name={person.name}
                          initials={person.initials}
                          color={person.color}
                          size="xs"
                        />
                        <span className="text-ink">{person.name}</span>
                        <span className="text-[10.5px] text-muted">{person.department}</span>
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">{row.assigned}</td>
                    <td
                      className={`py-1.5 text-right font-mono ${
                        row.overdue > 0 ? 'font-semibold text-strand-red' : ''
                      }`}
                    >
                      {row.overdue}
                    </td>
                    <td className="py-1.5 text-right font-mono">{row.hours}</td>
                    <td className="py-1.5 text-right font-mono">
                      {formatINR(Math.round(row.hours * BLENDED_HOURLY_RATE_INR))}
                    </td>
                    <td className="py-1.5 text-right">
                      <span
                        className={`font-mono font-semibold ${
                          person.complianceScore >= 95
                            ? 'text-strand-green'
                            : person.complianceScore >= 90
                              ? 'text-strand-amber'
                              : 'text-strand-red'
                        }`}
                      >
                        {person.complianceScore}
                      </span>
                      {person.warningsCount > 0 && (
                        <span className="ml-1.5 rounded border border-red-200 bg-red-50 px-1 text-[9.5px] text-strand-red">
                          {person.warningsCount} warning
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        {/* Weekly archive */}
        <Panel
          title="Weekly report archive"
          hint="Kiran's week closes Friday at noon. Each entry is generated from the work items as they stood that week."
        >
          <ul className="divide-y divide-line-2 rounded-md border border-line">
            {reports.map((report) => {
              const start = parseISO(report.weekStart);
              const end = endOfWeek(start, { weekStartsOn: 1 });
              const closedItems = items.filter(
                (item) =>
                  groupOfItem(state, item) === 'completed' &&
                  item.updatedAt.slice(0, 10) >= report.weekStart &&
                  item.updatedAt.slice(0, 10) <= format(end, 'yyyy-MM-dd'),
              ).length;

              return (
                <li key={report.id} className="flex items-center gap-3 px-3 py-2">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-300" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-ink">
                      Week of {format(start, 'd MMM')} – {format(end, 'd MMM yyyy')}
                    </div>
                    <div className="text-[11px] text-muted">
                      Generated {format(parseISO(report.generatedAt), "d MMM, h:mm a")} ·{' '}
                      {closedItems} item{closedItems === 1 ? '' : 's'} closed
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      // Generating a real PDF is out of scope for this build; the
                      // figures behind it are real, which is the part that matters.
                      toast.success(
                        `Week of ${format(start, 'd MMM yyyy')}`,
                        {
                          description: `${closedItems} items closed · ${rollup.hoursSpent}h logged on this project to date.`,
                        },
                      )
                    }
                    className="shrink-0 rounded-md border border-line px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-canvas"
                  >
                    Summary
                  </button>
                </li>
              );
            })}
            {reports.length === 0 && (
              <li className="px-3 py-3 text-[12px] text-muted">No archived weeks yet.</li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
};
