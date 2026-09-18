import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, RefreshCw } from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { EmployeeChip } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge, StagePill, StatusBadge } from '@/components/ui/StatusBadge';
import { LedgerBand, StatCard } from '@/components/ui/StatCard';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { AllowanceCard, ProgressBar } from '@/components/ui/ProgressBar';
import { useApp } from '@/context/AppContext';
// TODO: replace with API call
import { api } from '@/lib/api';
import type { Category, DepartmentUtilisation, MonthlySpend, ReceiptRequest, RequestStatus } from '@/lib/types';
import { CATEGORY_LABEL, PIPELINE_STAGES } from '@/lib/status';
import {
  DEMO_TODAY,
  cx,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatPercent,
  formatRelative,
} from '@/lib/format';

const PENDING_APPROVAL: RequestStatus[] = [
  'SUBMITTED',
  'HR_INFO_REQUESTED',
  'HR_APPROVED',
  'ACC_INFO_REQUESTED',
];
const AWAITING_PAYMENT: RequestStatus[] = ['ACC_APPROVED', 'PAYMENT_QUEUED'];

/**
 * The pipeline reads as stages on a route, in the Stepper's vocabulary: a numbered
 * node per desk, joined by a 2px rule that carries the colour of the stage it runs
 * into. Navy = cleared desks, orange = live work, green = money landed.
 */
const PIPELINE_NODES = [
  'border-darkey-bluey bg-darkey-bluey text-white',
  'border-darkey-bluey bg-darkey-bluey text-white',
  'border-orangy bg-orangy text-rich-black',
  'border-orangy bg-orangy text-rich-black',
  'border-st-green-ink bg-st-green-ink text-white',
];
const PIPELINE_RULES = [
  'bg-darkey-bluey',
  'bg-darkey-bluey',
  'bg-orangy',
  'bg-orangy',
  'bg-st-green-ink',
];
const PIPELINE_ROUTES = ['/hr', '/hr', '/accounts', '/payments', '/overview'];

/** Navy ramp plus the single orange accent — no third hue enters the charts. */
const DONUT_COLOURS = ['#02223C', '#E99741', '#0E4368', '#175A87', '#A7B3BE'];

/** Ticks are figures, so they are set in the instrument voice like every other number. */
const AXIS_TICK = {
  fill: '#5C6975',
  fontSize: 11,
  fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/**
 * Recharts' default tooltip is a rounded, shadowed card. This one is a torn-off slip:
 * hard edges, one hairline, mono figures. Recharts clones the element and merges its
 * own props in, so the formatter props passed at the call site survive.
 */
function LedgerTooltip({
  active,
  label,
  payload,
  nameFormatter,
}: {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  nameFormatter?: (name: string) => string;
}): JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="min-w-[168px] border border-hairline-strong bg-white">
      {label !== undefined && label !== '' ? (
        <p className="ku-eyebrow border-b border-hairline px-3 py-1.5 text-rich-black">
          {String(label)}
        </p>
      ) : null}
      <ul className="ku-ruled">
        {payload.map((entry, i) => {
          const name = String(entry.name ?? entry.dataKey ?? '');
          return (
            <li key={`${name}-${i}`} className="flex items-center gap-3 px-3 py-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0"
                style={{ background: entry.color ?? '#02223C' }}
              />
              <span className="flex-1 text-caption text-meta">
                {nameFormatter ? nameFormatter(name) : name}
              </span>
              <span className="ku-total text-caption">
                {typeof entry.value === 'number' ? formatCurrency(entry.value) : String(entry.value ?? '—')}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Every block on this page opens the same way: a heading and the 2px navy rule that
 * carries the ledger spine down the page. These are four independent readings of the
 * same register, not an ordered sequence, so nothing numbers them.
 */
function SectionHead({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-darkey-bluey pb-2">
      <div className="min-w-0">
        <h2 className="ku-wide font-display text-h3 font-semibold text-rich-black">{title}</h2>
        {note ? <p className="mt-1 text-body-s text-meta">{note}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export default function AdminOverview() {
  const navigate = useNavigate();
  const { employees, requests, payouts, currentEmployee } = useApp();

  const [categorySpend, setCategorySpend] = useState<{ category: Category; amount: number; count: number }[]>([]);
  const [departmentUtilisation, setDepartmentUtilisation] = useState<DepartmentUtilisation[]>([]);
  const [monthlySpend, setMonthlySpend] = useState<MonthlySpend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [cat, dept, month] = await Promise.all([
          api.getCategorySpend(),
          api.getDepartmentUtilisation(),
          api.getMonthlySpend(),
        ]);
        if (mounted) {
          setCategorySpend(cat);
          setDepartmentUtilisation(dept);
          setMonthlySpend(month);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to load overview data:', e);
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  const reload = () => {
    // Just re-mount the fetch or similar, for now we will just re-trigger state
    setLoading(true);
    api.getCategorySpend().then(setCategorySpend);
    api.getDepartmentUtilisation().then(setDepartmentUtilisation);
    api.getMonthlySpend().then(setMonthlySpend).finally(() => setLoading(false));
  };

  const totals = useMemo(() => {
    const pool = employees.reduce((sum, e) => sum + e.monthlyAllowance, 0);
    const paid = payouts.filter((p) => p.status === 'PAID');
    const pending = requests.filter((r) => PENDING_APPROVAL.includes(r.status));
    const awaiting = requests.filter((r) => AWAITING_PAYMENT.includes(r.status));
    return {
      pool,
      paidValue: paid.reduce((s, p) => s + p.amount, 0),
      paidCount: paid.length,
      pendingCount: pending.length,
      pendingValue: pending.reduce((s, r) => s + r.amount, 0),
      awaitingCount: awaiting.length,
      awaitingValue: awaiting.reduce((s, r) => s + r.amount, 0),
    };
  }, [employees, requests, payouts]);

  // The thesis figures — everything below is derived from the same memo.
  const inFlightValue = totals.pendingValue + totals.awaitingValue;
  const inFlightCount = totals.pendingCount + totals.awaitingCount;
  const uncommitted = Math.max(0, totals.pool - totals.paidValue - inFlightValue);
  const utilisation = totals.pool > 0 ? totals.paidValue / totals.pool : 0;

  const pipeline = useMemo(
    () =>
      PIPELINE_STAGES.map((stage) => {
        const matched = requests.filter((r) => stage.statuses.includes(r.status));
        return {
          key: stage.key,
          label: stage.label,
          count: matched.length,
          value: matched.reduce((s, r) => s + r.amount, 0),
        };
      }),
    [requests],
  );

  const recent = useMemo(
    () =>
      [...requests]
        .sort((a, b) => new Date(b.submittedOn).getTime() - new Date(a.submittedOn).getTime())
        .slice(0, 8),
    [requests],
  );

  const categoryTotal = useMemo(
    () => categorySpend.reduce((s, c) => s + c.amount, 0),
    [categorySpend],
  );

  /**
   * The one movement reading on the page, and it is the last step of the series the
   * chart below actually draws — not a decoration. It is set as plain mono text beside
   * the chart it came from; a caret chip would make a reading look like a verdict.
   */
  const movement = useMemo(() => {
    if (monthlySpend.length < 2) return null;
    const latest = monthlySpend[monthlySpend.length - 1];
    const previous = monthlySpend[monthlySpend.length - 2];
    if (previous.disbursed === 0) return null;
    return {
      month: latest.month,
      previous: previous.month,
      ratio: (latest.disbursed - previous.disbursed) / previous.disbursed,
    };
  }, [monthlySpend]);

  // Foot of the department ledger — a ruled table gets a total, on paper and here.
  const deptTotals = useMemo(
    () =>
      departmentUtilisation.reduce(
        (acc, d) => ({
          allocated: acc.allocated + d.allocated,
          used: acc.used + d.used,
          pending: acc.pending + d.pending,
          headcount: acc.headcount + d.headcount,
        }),
        { allocated: 0, used: 0, pending: 0, headcount: 0 },
      ),
    [departmentUtilisation],
  );

  const columns: Column<ReceiptRequest>[] = [
    {
      key: 'id',
      header: 'Docket',
      render: (r) => <span className="ku-docket text-rich-black">{r.id}</span>,
    },
    {
      key: 'employee',
      header: 'Filed by',
      render: (r) => {
        const emp = employees.find((e) => e.id === r.employeeId);
        return emp ? <EmployeeChip employee={emp} /> : <span className="text-meta">—</span>;
      },
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => <Badge>{CATEGORY_LABEL[r.category]}</Badge>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => (
        <span className="ku-fig font-semibold text-rich-black">{formatCurrency(r.amount)}</span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'stage', header: 'Desk', render: (r) => <StagePill stage={r.currentStage} /> },
    {
      key: 'submitted',
      header: 'Filed on',
      render: (r) => (
        <div>
          <p className="ku-fig text-body-s text-rich-black">{formatDate(r.submittedOn)}</p>
          <p className="ku-fig text-caption text-meta">{formatRelative(r.submittedOn)}</p>
        </div>
      ),
    },
    {
      key: 'go',
      header: '',
      align: 'right',
      render: (r) => (
        <IconButton
          icon={ArrowRight}
          label={`Open claim ${r.id}`}
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/requests/${r.id}`);
          }}
        />
      ),
    },
  ];

  const deptColumns: Column<(typeof departmentUtilisation)[number]>[] = [
    {
      key: 'department',
      header: 'Department',
      render: (d) => <span className="font-semibold text-rich-black">{d.department}</span>,
    },
    {
      key: 'headcount',
      header: 'Heads',
      align: 'right',
      render: (d) => <span className="ku-fig">{d.headcount}</span>,
    },
    {
      key: 'allocated',
      header: 'Allocated',
      align: 'right',
      render: (d) => <span className="ku-fig">{formatCurrency(d.allocated)}</span>,
    },
    {
      key: 'used',
      header: 'Used',
      align: 'right',
      render: (d) => (
        <span className="ku-fig font-semibold text-rich-black">{formatCurrency(d.used)}</span>
      ),
    },
    {
      key: 'pending',
      header: 'In flight',
      align: 'right',
      render: (d) => <span className="ku-fig">{formatCurrency(d.pending)}</span>,
    },
    {
      key: 'utilisation',
      header: 'Utilisation',
      width: '280px',
      render: (d) => {
        const ratio = d.used / d.allocated;
        return (
          <div className="flex items-center gap-3">
            <span className="ku-fig w-10 shrink-0 text-right text-body-s text-rich-black">
              {formatPercent(ratio)}
            </span>
            <ProgressBar
              className="flex-1"
              height={6}
              total={d.allocated}
              segments={[
                { value: d.used, className: 'bg-darkey-bluey', label: 'Used' },
                { value: d.pending, className: 'bg-orangy', label: 'In flight' },
                {
                  value: Math.max(0, d.allocated - d.used - d.pending),
                  className: 'bg-hairline-strong',
                  label: 'Uncommitted',
                },
              ]}
            />
            {ratio > 0.8 && (
              <span className="ku-stamp shrink-0 border-st-amber-line text-st-amber-ink">
                Near cap
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin Overview"
        subtitle="Where the allowance pool stands, what is still in flight, and which desk every open claim is waiting on."
        breadcrumb={[{ label: 'Home', to: '/overview' }, { label: 'Admin Overview' }]}
        actions={
          <>
            <Button variant="outline" icon={RefreshCw} onClick={reload}>
              Refresh figures
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => navigate('/my-requests')}>
              File a claim
            </Button>
          </>
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* The page's thesis: the ledger opened at today's page.             */}
      {/* This is the page's primary artifact and carries its one notch.    */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-6 xl:grid-cols-4">
        <div className="min-w-0 xl:col-span-3">
          <section className="ku-sheet ku-notch">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline px-5 py-2.5 sm:px-7">
              <p className="ku-eyebrow text-rich-black">Organisation ledger</p>
              <span aria-hidden="true" className="text-meta">
                ·
              </span>
              <p className="text-caption text-meta">
                As at <span className="ku-fig text-rich-black">{formatDate(DEMO_TODAY)}</span>
              </p>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
              <div className="p-5 sm:p-7">
                <p className="ku-eyebrow">Allowance pool, this period</p>
                {/*
                  Tracking is set as a utility rather than left to `.ku-total`: that class
                  applies `tracking-tight` from the components layer, so `text-figure-lg`'s
                  own -0.025em always wins. Indian grouping puts two commas in a nine-glyph
                  amount and a mono comma occupies a whole digit cell, so the figure needs
                  the extra pull or it reads as gapped.
                */}
                {loading ? (
                  <Skeleton className="mt-3 h-11 w-64" />
                ) : (
                  <p className="ku-total mt-3 text-figure-lg tracking-[-0.05em]">
                    {formatCurrency(totals.pool)}
                  </p>
                )}
                <p className="mt-2 max-w-md text-body-s text-meta">
                  Sanctioned across{' '}
                  <span className="ku-fig text-rich-black">{employees.length}</span> employees on
                  the register, over{' '}
                  <span className="ku-fig text-rich-black">{departmentUtilisation.length}</span>{' '}
                  departments.
                </p>

                <div className="mt-7">
                  <ProgressBar
                    className="animate-rule-in origin-left"
                    height={10}
                    total={totals.pool}
                    segments={[
                      { value: totals.paidValue, className: 'bg-darkey-bluey', label: 'Released' },
                      { value: inFlightValue, className: 'bg-orangy', label: 'In flight' },
                      { value: uncommitted, className: 'bg-hairline-strong', label: 'Uncommitted' },
                    ]}
                  />
                  <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8">
                    {[
                      { label: 'Released', value: totals.paidValue, swatch: 'bg-darkey-bluey' },
                      { label: 'In flight', value: inFlightValue, swatch: 'bg-orangy' },
                      { label: 'Uncommitted', value: uncommitted, swatch: 'bg-hairline-strong' },
                    ].map((item) => (
                      <li key={item.label} className="flex items-center gap-2">
                        <span aria-hidden="true" className={cx('h-3 w-3 shrink-0', item.swatch)} />
                        <span className="text-caption text-meta">{item.label}</span>
                        <span className="ku-fig ml-auto text-body-s font-semibold text-rich-black sm:ml-1">
                          {formatCurrency(item.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {/*
                    Utilisation reads off the bar it belongs to, so it sits here rather
                    than as a fourth band cell — the band has three-quarters of the well
                    and a four-glyph amount at 34px will not clear its hairline there.
                  */}
                  <p className="mt-5 border-t border-hairline pt-3 text-caption text-meta">
                    <span className="ku-fig text-rich-black">{formatPercent(utilisation)}</span> of
                    the sanctioned pool has been released against a UTR.
                  </p>
                </div>
              </div>

              <div className="border-t border-hairline p-5 sm:p-7 lg:border-l lg:border-t-0">
                <p className="ku-eyebrow">In flight right now</p>
                {/*
                  One register below the pool. The pool is the page's only 46px figure;
                  this is the sheet's second reading, and two of the band cells beneath
                  are this same number decomposed — so it must not tie with them.
                */}
                {loading ? (
                  <Skeleton className="mt-3 h-8 w-40" />
                ) : (
                  <p className="ku-total mt-3 text-h2">{formatCurrency(inFlightValue)}</p>
                )}
                <p className="mt-2 text-body-s text-meta">
                  <span className="ku-fig text-rich-black">{inFlightCount}</span> claims sitting
                  between the filing desk and a UTR.
                </p>
                <p className="mt-5 border-t border-hairline pt-3 text-caption text-meta">
                  <span className="ku-fig text-rich-black">
                    {formatPercent(totals.pool > 0 ? inFlightValue / totals.pool : 0)}
                  </span>{' '}
                  of the pool is committed but not yet released.
                </p>
              </div>
            </div>
          </section>

          {/* The ledger band sits flush under the sheet — one shared hairline. */}
          <LedgerBand cols={3} className="ku-stagger -mt-px">
            <StatCard
              loading={loading}
              label="Released this month"
              value={formatCurrency(totals.paidValue)}
              sublabel={`${totals.paidCount} payouts carrying a UTR`}
              tone="success"
            />
            <StatCard
              loading={loading}
              label="Waiting on a verdict"
              value={String(totals.pendingCount)}
              sublabel={`${formatCurrency(totals.pendingValue)} with HR and Accounts`}
              tone="orange"
            />
            <StatCard
              loading={loading}
              label="Cleared, not yet paid"
              value={String(totals.awaitingCount)}
              sublabel={`${formatCurrency(totals.awaitingValue)} queued for disbursement`}
              tone="navy"
            />
          </LedgerBand>
        </div>

        <div className="min-w-0">
          {/* A rail card: compact, so the personal figure sits a register below the pool. */}
          <AllowanceCard employee={currentEmployee} compact />
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Stages on a route, in the Stepper's language.                     */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <SectionHead
          title="Where the claims are standing"
          note="Every open claim, counted at the desk that owns it. Pick a stage to open that queue."
        />
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-0 xl:border xl:border-hairline xl:bg-white">
          {pipeline.map((stage, i) => (
            <li key={stage.key} className="min-w-0">
              <button
                type="button"
                onClick={() => navigate(PIPELINE_ROUTES[i])}
                aria-label={`${stage.label} — ${stage.count} claims, ${formatCompactCurrency(stage.value)}. Open this queue.`}
                className="flex h-full w-full flex-col items-stretch border border-hairline bg-white p-4 text-left transition-colors duration-150 hover:bg-canvas xl:border-0"
              >
                <span aria-hidden="true" className="flex items-center">
                  <span
                    className={cx(
                      'hidden h-0.5 flex-1 xl:block',
                      i === 0 ? 'bg-transparent' : PIPELINE_RULES[i],
                    )}
                  />
                  <span
                    className={cx(
                      'ku-fig flex h-8 w-8 shrink-0 items-center justify-center border-2 text-body-s font-semibold',
                      PIPELINE_NODES[i],
                    )}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={cx(
                      'hidden h-0.5 flex-1 xl:block',
                      i === pipeline.length - 1 ? 'bg-transparent' : PIPELINE_RULES[i + 1],
                    )}
                  />
                </span>
                <span aria-hidden="true" className="mt-4 block">
                  <span className="ku-total block text-h2 leading-none">{stage.count}</span>
                  <span className="mt-2 block text-body-s font-semibold text-rich-black">
                    {stage.label}
                  </span>
                  <span className="ku-fig mt-1 block text-caption text-meta">
                    {formatCompactCurrency(stage.value)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* One surface, divided by a hairline — not two floating cards.      */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <SectionHead
          title="Money out"
          note="Six months of releases against the sanctioned budget, and what the claims were for."
        />
        <div className="ku-card grid lg:grid-cols-3">
          <div className="min-w-0 p-5 lg:col-span-2">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <p className="ku-eyebrow text-rich-black">Released against budget</p>
                <p className="mt-1 text-body-s text-meta">
                  Last six months, all departments
                  {movement ? (
                    <>
                      {' · '}
                      <span className="ku-fig text-meta">
                        {movement.ratio >= 0 ? '+' : '−'}
                        {formatPercent(Math.abs(movement.ratio), 1)}
                      </span>{' '}
                      {movement.month} on {movement.previous}
                    </>
                  ) : null}
                </p>
              </div>
              {/* The key matches the line, so it darkens with it. */}
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-0.5 w-6 bg-link-on-light" />
                  <span className="text-caption text-meta">Released</span>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="w-6 border-t-2 border-dashed border-darkey-bluey"
                  />
                  <span className="text-caption text-meta">Budget</span>
                </li>
              </ul>
            </div>

            {loading ? (
              <SkeletonCard className="h-[280px]" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlySpend} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#D2D9DF" strokeWidth={1} vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={{ stroke: '#A7B3BE' }}
                    tickLine={false}
                    tick={AXIS_TICK}
                    tickMargin={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                    tickFormatter={(v: number) => formatCompactCurrency(v)}
                    width={64}
                  />
                  <Tooltip
                    cursor={{ stroke: '#A7B3BE', strokeWidth: 1 }}
                    content={<LedgerTooltip />}
                  />
                  <Line
                    type="linear"
                    dataKey="disbursed"
                    name="Released"
                    // link-on-light: the brand orange darkened for a white ground
                    // (design.md §3.3). #E99741 is 2.36:1 here — the primary series
                    // must not be the faint one.
                    stroke="#B26516"
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="budget"
                    name="Budget"
                    stroke="#02223C"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="min-w-0 border-t border-hairline p-5 lg:border-l lg:border-t-0">
            <p className="ku-eyebrow text-rich-black">Claimed by category</p>
            <p className="mt-1 text-body-s text-meta">Every claim on the register</p>

            {loading ? (
              <SkeletonCard className="mt-5 h-[200px]" />
            ) : (
              <>
                <div className="relative mt-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categorySpend}
                        dataKey="amount"
                        nameKey="category"
                        innerRadius={58}
                        outerRadius={86}
                        stroke="#fff"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {categorySpend.map((entry, i) => (
                          <Cell
                            key={entry.category}
                            fill={DONUT_COLOURS[i % DONUT_COLOURS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <LedgerTooltip
                            nameFormatter={(name) =>
                              CATEGORY_LABEL[name as keyof typeof CATEGORY_LABEL] ?? name
                            }
                          />
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="ku-eyebrow">Claimed</span>
                    <span className="ku-total mt-1 text-h3">
                      {formatCompactCurrency(categoryTotal)}
                    </span>
                  </div>
                </div>

                {/*
                  A ruled column head, so it is set the way DataTable sets one: Archivo
                  condensed, not the mono eyebrow. The eyebrow opens a block; it does not
                  head a column.
                */}
                <div className="mt-5 flex items-center gap-3 border-b-2 border-darkey-bluey pb-1.5">
                  <span aria-hidden="true" className="w-2.5 shrink-0" />
                  <span className="ku-narrow flex-1 text-micro font-semibold uppercase text-meta">
                    Category
                  </span>
                  <span className="ku-narrow w-12 shrink-0 text-right text-micro font-semibold uppercase text-meta">
                    Claims
                  </span>
                  <span className="ku-narrow w-24 shrink-0 text-right text-micro font-semibold uppercase text-meta">
                    Amount
                  </span>
                </div>
                <ul className="ku-ruled">
                  {categorySpend.map((entry, i) => (
                    <li key={entry.category} className="flex items-center gap-3 py-2">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0"
                        style={{ background: DONUT_COLOURS[i % DONUT_COLOURS.length] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-body-s text-rich-black">
                        {CATEGORY_LABEL[entry.category]}
                      </span>
                      <span className="ku-fig w-12 shrink-0 text-right text-caption text-meta">
                        {entry.count}
                      </span>
                      <span className="ku-fig w-24 shrink-0 text-right text-body-s font-semibold text-rich-black">
                        {formatCurrency(entry.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3 border-t-2 border-darkey-bluey py-2">
                  <span className="ku-eyebrow flex-1 text-rich-black">Total claimed</span>
                  <span className="ku-total w-24 shrink-0 text-right text-body-s">
                    {formatCurrency(categoryTotal)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Latest filings                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <SectionHead
          title="Latest filings"
          note="The eight most recent claims to reach the ledger, newest first."
          action={
            <Button
              variant="ghost"
              size="sm"
              iconRight={ArrowRight}
              onClick={() => navigate('/hr')}
            >
              Open the HR queue
            </Button>
          }
        />
        <DataTable
          columns={columns}
          rows={recent}
          rowKey={(r) => r.id}
          loading={loading}
          onRowClick={(r) => navigate(`/requests/${r.id}`)}
          empty={
            <EmptyState
              eyebrow="Nothing filed"
              title="No claims have reached the ledger"
              description="New submissions land here the moment an employee files one."
              action={
                <Button variant="primary" icon={Plus} onClick={() => navigate('/my-requests')}>
                  File a claim
                </Button>
              }
            />
          }
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Department utilisation — a ruled ledger with a total at the foot. */}
      {/* ---------------------------------------------------------------- */}
      <section>
        <SectionHead
          title="Department utilisation"
          note="Allowance consumed against allocation, department by department."
        />
        <DataTable
          dense
          columns={deptColumns}
          rows={departmentUtilisation}
          rowKey={(d) => d.department}
          loading={loading}
          empty={
            <EmptyState
              eyebrow="No allocation"
              title="No department carries an allowance yet"
              description="Allocate a pool to a department and its utilisation appears on this line."
            />
          }
        />
        {!loading && (
          <div className="ku-card -mt-px flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t-2 border-t-darkey-bluey px-3 py-2.5">
            <span className="ku-eyebrow text-rich-black">Total, all departments</span>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="text-caption text-meta">
                Heads <span className="ku-fig text-rich-black">{deptTotals.headcount}</span>
              </span>
              <span className="text-caption text-meta">
                Allocated{' '}
                <span className="ku-fig text-rich-black">
                  {formatCurrency(deptTotals.allocated)}
                </span>
              </span>
              <span className="text-caption text-meta">
                Used{' '}
                <span className="ku-total text-body-s">{formatCurrency(deptTotals.used)}</span>
              </span>
              <span className="text-caption text-meta">
                In flight{' '}
                <span className="ku-fig text-rich-black">{formatCurrency(deptTotals.pending)}</span>
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
