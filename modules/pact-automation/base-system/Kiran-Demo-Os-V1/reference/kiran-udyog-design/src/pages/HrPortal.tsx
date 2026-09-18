import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Check, MessageSquareWarning, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { Column, SortState } from '@/components/ui/DataTable';
import { Avatar, EmployeeChip } from '@/components/ui/Avatar';
import { Badge, SlaChip, StagePill, Stamp, StatusBadge } from '@/components/ui/StatusBadge';
import { LedgerBand, StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Drawer } from '@/components/ui/Drawer';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar } from '@/components/ui/FilterBar';
import type { ActiveFilter } from '@/components/ui/FilterBar';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { AllowanceCard } from '@/components/ui/ProgressBar';
import { Timeline } from '@/components/ui/Timeline';
import { ReceiptGrid, ReceiptLightbox } from '@/components/ui/FileDropzone';
import { useApp } from '@/context/AppContext';
import type { Category, Employee, ReceiptFile, ReceiptRequest, RequestStatus } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_LABEL, STAGE_LABEL, isTerminal, statusMeta } from '@/lib/status';
import {
  DEMO_TODAY,
  cx,
  daysUntil,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDateTime,
  slaState,
} from '@/lib/format';

const HR_ACTOR = 'Meera Nair';

const TAB_FILTERS: Record<string, RequestStatus[] | null> = {
  all: null,
  pending: ['SUBMITTED'],
  info: ['HR_INFO_REQUESTED'],
  approved: ['HR_APPROVED'],
  rejected: ['HR_REJECTED'],
};

/** The standfirst over the queue — it names the pile the approver is actually looking at. */
const TAB_HEADING: Record<string, string> = {
  all: 'Every claim on this desk',
  pending: 'Waiting on your review',
  info: 'Query raised with the employee',
  approved: 'Cleared and passed to Accounts',
  rejected: 'Refused by HR',
};

/** What lands in each pile once it empties — an invitation, never an apology. */
const TAB_EMPTY: Record<string, { title: string; description: string }> = {
  all: {
    title: 'The desk is clear',
    description:
      'Nothing has been filed against HR yet. New submissions land here the moment an employee files them.',
  },
  pending: {
    title: 'No claims are waiting on HR',
    description:
      'Every filed claim has been cleared, refused or queried. New submissions land here first.',
  },
  info: {
    title: 'No open queries',
    description:
      'Raise a query from the review panel when a claim needs a receipt, a date or a straighter justification.',
  },
  approved: {
    title: 'Nothing cleared yet',
    description:
      'Claims you clear move to Accounts for the second pass, and stay listed here for the record.',
  },
  rejected: {
    title: 'Nothing refused',
    description: 'Refused claims stay on file with the note you sent the employee.',
  },
};

/** Filter values as the chip rail reads them back — never the raw enum. */
const AMOUNT_LABEL: Record<string, string> = {
  LOW: 'Under ₹5,000',
  MID: '₹5,000 – ₹20,000',
  HIGH: 'Over ₹20,000',
};

const FILED_LABEL: Record<string, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
};

/** Ruled heading for a block inside the review panel. */
function SectionHead({ label, note }: { label: string; note?: string }): JSX.Element {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-hairline pb-1.5">
      <h4 className="ku-eyebrow">{label}</h4>
      {note ? <span className="ku-fig text-caption text-meta">{note}</span> : null}
    </div>
  );
}

export default function HrPortal() {
  // TODO: replace with API call
  const { requests, employees, employeeById, updateRequestStatus } = useApp();

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [amountRange, setAmountRange] = useState('ANY');
  const [dateRange, setDateRange] = useState('ANY');
  const [sort, setSort] = useState<SortState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<ReceiptRequest | null>(null);
  const [comment, setComment] = useState('');
  const [lightbox, setLightbox] = useState<ReceiptFile | null>(null);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees],
  );

  const kpis = useMemo(() => {
    const by = (s: RequestStatus) => requests.filter((r) => r.status === s);
    const pending = by('SUBMITTED');
    const approved = by('HR_APPROVED');
    return {
      pendingCount: pending.length,
      pendingValue: pending.reduce((s, r) => s + r.amount, 0),
      approvedCount: approved.length,
      approvedValue: approved.reduce((s, r) => s + r.amount, 0),
      rejectedCount: by('HR_REJECTED').length,
      // The figure this desk is judged on: filed claims already past their review SLA.
      overdueCount: pending.filter((r) => slaState(r.slaDueOn)?.overdue).length,
    };
  }, [requests]);

  const tabCounts = useMemo(() => {
    const count = (key: string) => {
      const statuses = TAB_FILTERS[key];
      return statuses ? requests.filter((r) => statuses.includes(r.status)).length : requests.length;
    };
    return {
      all: count('all'),
      pending: count('pending'),
      info: count('info'),
      approved: count('approved'),
      rejected: count('rejected'),
    };
  }, [requests]);

  const filtered = useMemo(() => {
    const statuses = TAB_FILTERS[tab];
    const q = search.trim().toLowerCase();

    return requests.filter((r) => {
      if (statuses && !statuses.includes(r.status)) return false;

      const emp = employeeById(r.employeeId);
      if (q) {
        const haystack = `${r.id} ${r.title} ${emp?.name ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (dept !== 'ALL' && emp?.department !== dept) return false;
      if (category !== 'ALL' && r.category !== category) return false;

      if (amountRange === 'LOW' && r.amount >= 5000) return false;
      if (amountRange === 'MID' && (r.amount < 5000 || r.amount > 20000)) return false;
      if (amountRange === 'HIGH' && r.amount <= 20000) return false;

      if (dateRange !== 'ANY') {
        const age = -daysUntil(r.submittedOn, DEMO_TODAY);
        if (dateRange === '7' && age > 7) return false;
        if (dateRange === '30' && age > 30) return false;
      }
      return true;
    });
  }, [requests, tab, search, dept, category, amountRange, dateRange, employeeById]);

  /**
   * Column sort is opt-in and caller-owned: with no sort set the queue keeps the order
   * it arrived in, which is what an approver working top-down expects. A claim with no
   * SLA date sorts to the end, so it can never sit above an overdue one.
   */
  const rows = useMemo(() => {
    if (!sort) return filtered;
    const direction = sort.direction === 'asc' ? 1 : -1;
    const keyOf = (r: ReceiptRequest): string | number => {
      switch (sort.key) {
        case 'employee':
          return employeeById(r.employeeId)?.name ?? '';
        case 'title':
          return r.title;
        case 'amount':
          return r.amount;
        case 'submitted':
          return new Date(r.submittedOn).getTime();
        case 'sla':
          return r.slaDueOn ? new Date(r.slaDueOn).getTime() : Number.MAX_SAFE_INTEGER;
        default:
          return r.id;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = keyOf(a);
      const bv = keyOf(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      return String(av).localeCompare(String(bv)) * direction;
    });
  }, [filtered, sort, employeeById]);

  const queueValue = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  /**
   * The desk's own SLA reading, taken off the claims actually on view so it sits at the
   * same scope as the two figures beside it. For every claim HR has already ruled on, the
   * gap between the employee filing it and the first HR event on its audit trail — median
   * rather than mean, so one claim left over a shutdown cannot skew the desk's record.
   * Null when nothing on view has been ruled on — the header then says so in words rather
   * than printing a figure, because no reading at all beats an invented one.
   */
  const medianTurnaroundDays = useMemo(() => {
    const gaps = rows
      .map((r) => {
        const filed = r.timeline.find((e) => e.role === 'EMPLOYEE');
        const ruled = r.timeline.find((e) => e.role === 'HR');
        if (!filed || !ruled) return null;
        const days = (new Date(ruled.at).getTime() - new Date(filed.at).getTime()) / 86_400_000;
        return Number.isFinite(days) && days >= 0 ? days : null;
      })
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b);

    if (gaps.length === 0) return null;
    const mid = Math.floor(gaps.length / 2);
    return gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
  }, [rows]);

  /** Every narrowing currently applied, read back as releasable chips under the controls. */
  const activeFilters: ActiveFilter[] = [
    ...(search.trim()
      ? [{ label: 'Search', value: search.trim(), onClear: () => setSearch('') }]
      : []),
    ...(dept !== 'ALL' ? [{ label: 'Dept', value: dept, onClear: () => setDept('ALL') }] : []),
    ...(category !== 'ALL'
      ? [
          {
            label: 'Category',
            value: CATEGORY_LABEL[category as Category],
            onClear: () => setCategory('ALL'),
          },
        ]
      : []),
    ...(amountRange !== 'ANY'
      ? [
          {
            label: 'Amount',
            value: AMOUNT_LABEL[amountRange],
            onClear: () => setAmountRange('ANY'),
          },
        ]
      : []),
    ...(dateRange !== 'ANY'
      ? [{ label: 'Filed', value: FILED_LABEL[dateRange], onClear: () => setDateRange('ANY') }]
      : []),
  ];

  const filtersActive = activeFilters.length > 0;

  const resetFilters = () => {
    setSearch('');
    setDept('ALL');
    setCategory('ALL');
    setAmountRange('ANY');
    setDateRange('ANY');
  };

  const selectedTotal = useMemo(
    () =>
      requests
        .filter((r) => selected.includes(r.id))
        .reduce((s, r) => s + r.amount, 0),
    [requests, selected],
  );

  const decide = (id: string, status: RequestStatus, note?: string) => {
    updateRequestStatus(id, status, HR_ACTOR, 'HR', note);
  };

  const bulk = (status: RequestStatus) => {
    selected.forEach((id) => decide(id, status));
    setSelected([]);
  };

  const closeDrawer = () => {
    setActive(null);
    setComment('');
  };

  const drawerDecide = (status: RequestStatus) => {
    if (!active) return;
    decide(active.id, status, comment.trim() || undefined);
    closeDrawer();
  };

  const remainingFor = (emp?: Employee) =>
    emp ? Math.max(0, emp.monthlyAllowance - emp.usedThisMonth - emp.pendingAmount) : 0;

  const columns: Column<ReceiptRequest>[] = [
    {
      key: 'id',
      header: 'Docket',
      sortable: true,
      width: '118px',
      render: (r) => <span className="ku-docket text-rich-black">{r.id}</span>,
    },
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      render: (r) => {
        const emp = employeeById(r.employeeId);
        return emp ? <EmployeeChip employee={emp} showDept /> : <span className="text-meta">—</span>;
      },
    },
    {
      key: 'title',
      header: 'Claim',
      sortable: true,
      render: (r) => (
        <>
          <span
            className="block max-w-[230px] truncate font-semibold text-rich-black"
            title={r.title}
          >
            {r.title}
          </span>
          <span className="ku-eyebrow">{CATEGORY_LABEL[r.category]}</span>
        </>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      sortable: true,
      render: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span>,
    },
    {
      key: 'balance',
      header: 'Allowance left',
      numeric: true,
      render: (r) => {
        const emp = employeeById(r.employeeId);
        const remaining = remainingFor(emp);
        const low = emp ? remaining < 0.2 * emp.monthlyAllowance : false;
        return (
          <span className={low ? 'font-semibold text-st-amber-ink' : 'text-meta'}>
            {formatCurrency(remaining)}
          </span>
        );
      },
    },
    {
      key: 'submitted',
      header: 'Filed',
      sortable: true,
      render: (r) => (
        <span className="ku-fig whitespace-nowrap text-rich-black">{formatDate(r.submittedOn)}</span>
      ),
    },
    {
      key: 'sla',
      header: 'Review SLA',
      sortable: true,
      render: (r) => {
        const sla = slaState(r.slaDueOn);
        /*
          The overdue tick: a 3px red rule in the margin of exactly the rows that are
          late, so the column can be scanned in one pass. Colour is never carrying it
          alone — the stamp beside it still reads "Overdue by 3d".
        */
        return (
          <div
            className={cx(
              'border-l-3 pl-2.5',
              sla?.overdue ? 'border-l-washed' : 'border-l-transparent',
            )}
          >
            {sla ? <SlaChip dueOn={r.slaDueOn} /> : <span className="text-meta">—</span>}
            {r.slaDueOn ? (
              <p className="ku-fig mt-1 text-micro text-meta">Due {formatDate(r.slaDueOn)}</p>
            ) : null}
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setActive(r);
            }}
          >
            Review
          </Button>
          <IconButton
            icon={Check}
            label={`Approve claim ${r.id}`}
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              decide(r.id, 'HR_APPROVED');
            }}
          />
          <IconButton
            icon={X}
            label={`Reject claim ${r.id}`}
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              decide(r.id, 'HR_REJECTED');
            }}
          />
        </div>
      ),
    },
  ];

  const activeEmployee = active ? employeeById(active.employeeId) : undefined;
  const activeMeta = active ? statusMeta(active.status) : null;

  const facts: { label: string; value: ReactNode }[] = active
    ? [
        { label: 'Category', value: <Badge>{CATEGORY_LABEL[active.category]}</Badge> },
        {
          label: 'Amount claimed',
          value: <span className="ku-total text-lead">{formatCurrency(active.amount)}</span>,
        },
        {
          label: 'Travel dates',
          value: <span className="ku-fig">{formatDateRange(active.travelDates)}</span>,
        },
        {
          label: 'Filed',
          value: <span className="ku-fig">{formatDateTime(active.submittedOn)}</span>,
        },
        {
          label: 'Review SLA',
          value: active.slaDueOn ? (
            <SlaChip dueOn={active.slaDueOn} />
          ) : (
            <span className="text-meta">Not set</span>
          ),
        },
        { label: 'Sitting with', value: <StagePill stage={active.currentStage} /> },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="HR approval desk"
        subtitle="First-level clearance. Check the business need, the justification and what is left of the employee’s allowance, then clear the claim through to Accounts or send it back with a query."
        breadcrumb={[{ label: 'Home', to: '/overview' }, { label: 'HR Portal' }]}
      />

      {/*
        The desk in four figures. One ruled band, not four cards floating on the canvas —
        and one tone across the whole band, because these four cells are four readings off
        the same account, not four verdicts. Colour is held back for the one cell that is
        genuinely exceptional: a claim that has run past its review SLA. A red rule there
        means something precisely because nothing else in the band is coloured.
      */}
      <LedgerBand cols={4}>
        <StatCard
          label="Awaiting HR"
          value={String(kpis.pendingCount)}
          sublabel={
            <>
              <span className="ku-fig">{formatCurrency(kpis.pendingValue)}</span> unreviewed
            </>
          }
          tone="navy"
        />
        <StatCard
          label="Past SLA"
          value={String(kpis.overdueCount)}
          sublabel={
            kpis.overdueCount > 0 ? (
              <>
                of <span className="ku-fig">{kpis.pendingCount}</span> awaiting
              </>
            ) : (
              'nothing breached'
            )
          }
          tone={kpis.overdueCount > 0 ? 'danger' : 'navy'}
        />
        <StatCard
          label="Cleared by HR"
          value={String(kpis.approvedCount)}
          sublabel={
            <>
              <span className="ku-fig">{formatCurrency(kpis.approvedValue)}</span> to Accounts
            </>
          }
          tone="navy"
        />
        <StatCard
          label="Refused"
          value={String(kpis.rejectedCount)}
          sublabel="closed, on file"
          tone="navy"
        />
      </LedgerBand>

      <div className="mt-8">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All claims', count: tabCounts.all },
            { key: 'pending', label: 'Awaiting review', count: tabCounts.pending },
            { key: 'info', label: 'Query raised', count: tabCounts.info },
            { key: 'approved', label: 'Cleared', count: tabCounts.approved },
            { key: 'rejected', label: 'Refused', count: tabCounts.rejected },
          ]}
        />
      </div>

      <FilterBar
        onReset={resetFilters}
        filters={activeFilters}
        className="mt-4"
      >
        <Field label="Search" className="min-w-[220px] flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Docket, claim title or employee"
          />
        </Field>
        <Field label="Department" className="min-w-[160px]">
          <Select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="ALL">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category" className="min-w-[150px]">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="ALL">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" className="min-w-[170px]">
          <Select value={amountRange} onChange={(e) => setAmountRange(e.target.value)}>
            <option value="ANY">Any amount</option>
            <option value="LOW">Under ₹5,000</option>
            <option value="MID">₹5,000 – ₹20,000</option>
            <option value="HIGH">Over ₹20,000</option>
          </Select>
        </Field>
        <Field label="Filed" className="min-w-[150px]">
          <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="ANY">Any time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </Select>
        </Field>
      </FilterBar>

      {/*
        The action bar is anchored and ruled, not a floating pill: a navy plate with an
        orange rule struck across the top, the tally on the left in the figure face and
        the decisions on the right. `top-0` because <main> is itself the scrollport and
        already starts below the topbar — any offset here just opens a gap for rows to
        scroll through above the plate.
      */}
      {selected.length > 0 && (
        <div className="sticky top-0 z-20 mt-4 animate-fade-rise border-t-3 border-t-orangy bg-darkey-bluey">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div>
                <p className="ku-eyebrow text-white/70">Marked for decision</p>
                <p className="mt-0.5 text-body font-semibold text-white">
                  <span className="ku-fig">{selected.length}</span>{' '}
                  {selected.length === 1 ? 'claim' : 'claims'}
                </p>
              </div>
              <div className="border-l border-white/25 pl-8">
                <p className="ku-eyebrow text-white/70">Value</p>
                <p className="ku-fig mt-0.5 text-body font-semibold text-white">
                  {formatCurrency(selectedTotal)}
                </p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* Button's base class is `font-sans`, so a bare count would fall out of
                  the figure face one flex row from the same tally set in `ku-fig`. */}
              <Button variant="primary" size="sm" onClick={() => bulk('HR_APPROVED')}>
                Approve <span className="ku-fig">{selected.length}</span>
              </Button>
              <Button
                size="sm"
                onClick={() => bulk('HR_REJECTED')}
                className="border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                Reject <span className="ku-fig">{selected.length}</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setSelected([])}
                className="border-transparent bg-transparent text-white hover:bg-white/10"
              >
                Clear selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* The queue is the page. Everything above it is a caption on it. */}
      <section className="ku-sheet mt-4">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <p className="ku-eyebrow">Approval queue</p>
            <h2 className="ku-wide mt-1.5 font-display text-h3 font-semibold text-rich-black">
              {TAB_HEADING[tab]}
            </h2>
          </div>

          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div>
              <dt className="ku-eyebrow">Rows</dt>
              <dd className="ku-fig mt-0.5 text-body font-semibold text-rich-black">
                {rows.length}
              </dd>
            </div>
            <div>
              <dt className="ku-eyebrow">Value on view</dt>
              <dd className="ku-fig mt-0.5 text-body font-semibold text-rich-black">
                {formatCurrency(queueValue)}
              </dd>
            </div>
            <div>
              <dt className="ku-eyebrow">Median turnaround</dt>
              <dd className="mt-0.5 text-body font-semibold text-rich-black">
                {medianTurnaroundDays === null ? (
                  <span className="font-normal text-meta">None ruled yet</span>
                ) : (
                  /* Always one decimal, so "days" is always the right plural. */
                  <>
                    <span className="ku-fig">{medianTurnaroundDays.toFixed(1)}</span> days
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {kpis.overdueCount > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-l-3 border-hairline border-l-washed px-5 py-2.5">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-st-red-ink" />
            <p className="min-w-0 flex-1 text-body-s text-rich-black">
              <span className="ku-fig font-semibold text-st-red-ink">{kpis.overdueCount}</span>{' '}
              {kpis.overdueCount === 1 ? 'claim is' : 'claims are'} past the review SLA for this desk.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSort({ key: 'sla', direction: 'asc' })}
            >
              Sort oldest SLA first
            </Button>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          selectable
          selectedIds={selected}
          onSelectionChange={setSelected}
          onRowClick={(r) => setActive(r)}
          sort={sort}
          onSortChange={(key, direction) => setSort({ key, direction })}
          empty={
            filtersActive ? (
              <EmptyState
                eyebrow="No match"
                title="Nothing matches this filter set"
                description="Widen the amount or date range, or clear the filters to bring the whole desk back."
                action={
                  <Button variant="outline" onClick={resetFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                eyebrow="Desk clear"
                title={TAB_EMPTY[tab].title}
                description={TAB_EMPTY[tab].description}
              />
            )
          }
        />
      </section>

      <Drawer
        open={Boolean(active)}
        onClose={closeDrawer}
        title={active ? active.title : ''}
        subtitle={
          active
            ? `${CATEGORY_LABEL[active.category]} · ${STAGE_LABEL[active.currentStage]}`
            : undefined
        }
        width="xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="success" icon={Check} onClick={() => drawerDecide('HR_APPROVED')}>
              Approve claim
            </Button>
            <Button
              variant="outline"
              icon={MessageSquareWarning}
              onClick={() => drawerDecide('HR_INFO_REQUESTED')}
            >
              Raise a query
            </Button>
            <Button variant="danger" icon={X} onClick={() => drawerDecide('HR_REJECTED')}>
              Reject claim
            </Button>
          </div>
        }
      >
        {active && activeMeta && (
          <div className="space-y-7">
            {/*
              The docket head. A decided claim carries the struck stamp — the one loud
              mark on this surface, and only ever on a record that has already settled.
            */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-darkey-bluey pb-4">
              <div className="min-w-0">
                <p className="ku-docket">{active.id}</p>
                <p className="ku-total mt-1.5 text-figure">{formatCurrency(active.amount)}</p>
                <p className="mt-1.5 text-body-s text-meta">
                  <span className="ku-fig text-rich-black">{active.receipts.length}</span>{' '}
                  {active.receipts.length === 1 ? 'receipt' : 'receipts'} attached · filed{' '}
                  <span className="ku-fig text-rich-black">{formatDate(active.submittedOn)}</span>
                </p>
              </div>
              {isTerminal(active.status) ? (
                <Stamp label={activeMeta.label} tone={activeMeta.tone} className="mt-2 shrink-0" />
              ) : (
                <StatusBadge status={active.status} size="md" className="mt-1 shrink-0" />
              )}
            </div>

            {activeEmployee && (
              <div>
                <SectionHead label="Claimant" note={activeEmployee.employeeCode} />
                <div className="flex items-start gap-3">
                  <Avatar name={activeEmployee.name} size="lg" />
                  <div className="min-w-0">
                    <p className="ku-wide font-display text-lead font-semibold text-rich-black">
                      {activeEmployee.name}
                    </p>
                    <p className="text-body-s text-meta">
                      {activeEmployee.designation} · {activeEmployee.department}
                    </p>
                    <p className="text-body-s text-meta">Reports to {activeEmployee.managerName}</p>
                    <p className="text-body-s text-meta">{activeEmployee.email}</p>
                  </div>
                </div>
              </div>
            )}

            {activeEmployee && (
              <div>
                <SectionHead label="Allowance position" />
                <AllowanceCard employee={activeEmployee} compact />
              </div>
            )}

            <div>
              <SectionHead label="Claim record" />
              <dl className="ku-ruled border-y border-hairline">
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5"
                  >
                    <dt className="ku-eyebrow">{fact.label}</dt>
                    <dd className="min-w-0 text-right text-body-s text-rich-black">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <SectionHead label="Justification" />
              <p className="ku-rule-accent py-1 text-body leading-relaxed text-light-black">
                {active.justification}
              </p>
            </div>

            <div>
              <SectionHead label="Receipts" note={String(active.receipts.length)} />
              {active.receipts.length > 0 ? (
                <ReceiptGrid receipts={active.receipts} columns={2} onPreview={setLightbox} />
              ) : (
                <p className="text-body-s text-meta">
                  No receipt is on file. Raise a query before you clear this claim.
                </p>
              )}
            </div>

            <div>
              <SectionHead label="Audit trail" />
              <Timeline events={active.timeline} />
            </div>

            <Field
              label="Note to the employee"
              hint="Sent with your decision and kept on the claim’s audit trail."
            >
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Say what you decided and why — the employee reads this verbatim."
              />
            </Field>
          </div>
        )}
      </Drawer>

      <ReceiptLightbox receipt={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
