import { useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  CornerUpLeft,
  Inbox,
  Lock,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Avatar, EmployeeChip } from '@/components/ui/Avatar';
import { Badge, Stamp, StatusBadge } from '@/components/ui/StatusBadge';
import { LedgerBand, StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Drawer } from '@/components/ui/Drawer';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar } from '@/components/ui/FilterBar';
import type { ActiveFilter } from '@/components/ui/FilterBar';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { AllowanceCard, ProgressBar } from '@/components/ui/ProgressBar';
import { Timeline } from '@/components/ui/Timeline';
import { ReceiptGrid, ReceiptLightbox } from '@/components/ui/FileDropzone';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import type { Category, ReceiptFile, ReceiptRequest, RequestStatus, PolicyCap, DepartmentUtilisation } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_LABEL, accountsBlockedReason, isHrCleared } from '@/lib/status';
import {
  DEMO_TODAY,
  cx,
  daysUntil,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatFileSize,
  formatPercent,
} from '@/lib/format';

const ACC_ACTOR = 'Vikram Sethi';

const TAB_FILTERS: Record<string, RequestStatus[] | null> = {
  all: null,
  awaiting: ['HR_APPROVED'],
  info: ['ACC_INFO_REQUESTED'],
  approved: ['ACC_APPROVED'],
  rejected: ['ACC_REJECTED'],
};

/** What lands in each tab when the ledger is genuinely empty — an invitation, not an apology. */
const TAB_EMPTY: Record<string, { title: string; description: string }> = {
  all: {
    title: 'The queue is clear',
    description: 'Nothing has passed HR yet. Claims land here only once HR clears them.',
  },
  awaiting: {
    title: 'No claims are waiting on Accounts',
    description: 'Every claim HR cleared has been decided or queried.',
  },
  info: {
    title: 'No open queries',
    description: 'Claims queried from the review panel will sit here until the employee replies.',
  },
  approved: {
    title: 'Nothing queued for payment',
    description: 'Claims you approve move to the Disbursement run and stay listed here for the record.',
  },
  rejected: {
    title: 'Nothing refused',
    description: 'Refused claims stay on file with the note you sent the employee.',
  },
};

const AMOUNT_LABEL: Record<string, string> = {
  LOW: 'Under ₹5,000',
  MID: '₹5,000 – ₹20,000',
  HIGH: 'Over ₹20,000',
};

const DATE_LABEL: Record<string, string> = { '7': 'Last 7 days', '30': 'Last 30 days' };

interface DeptRow {
  department: string;
  allocated: number;
  used: number;
  pending: number;
  headcount: number;
  headroom: number;
}

function capFor(category: Category, policyCaps: PolicyCap[]) {
  return policyCaps.find((p) => p.category === category);
}

function headroomFor(departmentUtilisation: DepartmentUtilisation[], department?: string) {
  const row = departmentUtilisation.find((d) => d.department === department);
  if (!row) return null;
  return { row, headroom: Math.max(0, row.allocated - row.used - row.pending) };
}

/**
 * One ruled block inside the review panel. The eyebrow sits on its own hairline, so the
 * panel reads as a stack of ruled sections on a voucher rather than a run of loose cards.
 * `meta` is set in the reading voice: a caller carrying a figure wraps that figure in
 * `ku-fig` itself, so the instrument face never lands on an English word.
 */
function PanelSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-hairline pb-1.5">
        <h4 className="ku-eyebrow">{title}</h4>
        {meta ? <span className="text-caption text-meta">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** A term/figure pair on the voucher record. Terms are stamped, values are read. */
function RecordRow({ term, children }: { term: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
      <dt className="ku-eyebrow">{term}</dt>
      <dd className="text-body-s text-rich-black">{children}</dd>
    </div>
  );
}

export default function AccountsPortal() {
  const navigate = useNavigate();
  const { requests, employees, employeeById, updateRequestStatus } = useApp();

  const [departmentUtilisation, setDepartmentUtilisation] = useState<DepartmentUtilisation[]>([]);
  const [policyCaps, setPolicyCaps] = useState<PolicyCap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [dept, caps] = await Promise.all([
          api.getDepartmentUtilisation(),
          api.getPolicyCaps(),
        ]);
        if (mounted) {
          setDepartmentUtilisation(dept);
          setPolicyCaps(caps);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [amountRange, setAmountRange] = useState('ANY');
  const [dateRange, setDateRange] = useState('ANY');
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<ReceiptRequest | null>(null);
  const [comment, setComment] = useState('');
  const [lightbox, setLightbox] = useState<ReceiptFile | null>(null);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees],
  );

  const kpis = useMemo(() => {
    const awaiting = requests.filter((r) => r.status === 'HR_APPROVED');
    const queued = requests.filter(
      (r) => r.status === 'ACC_APPROVED' || r.status === 'PAYMENT_QUEUED',
    );
    return {
      awaitingCount: awaiting.length,
      awaitingValue: awaiting.reduce((s, r) => s + r.amount, 0),
      queuedCount: queued.length,
      queuedValue: queued.reduce((s, r) => s + r.amount, 0),
      rejectedCount: requests.filter((r) => r.status === 'ACC_REJECTED').length,
      duplicateCount: requests.filter((r) => Boolean(r.duplicateOf)).length,
      overCapCount: requests.filter((r) => {
        const cap = capFor(r.category, policyCaps);
        return cap ? r.amount > cap.cap : false;
      }).length,
    };
  }, [requests, policyCaps]);

  /** Org-wide budget position — the financial frame this portal leads with. */
  const budget = useMemo(() => {
    const allocated = departmentUtilisation.reduce((s, d) => s + d.allocated, 0);
    const used = departmentUtilisation.reduce((s, d) => s + d.used, 0);
    const pending = departmentUtilisation.reduce((s, d) => s + d.pending, 0);
    return { allocated, used, pending, headroom: Math.max(0, allocated - used - pending) };
  }, []);

  const deptRows = useMemo<DeptRow[]>(
    () =>
      departmentUtilisation.map((d) => ({
        ...d,
        headroom: Math.max(0, d.allocated - d.used - d.pending),
      })),
    [],
  );

  const tabCounts = useMemo(() => {
    const count = (key: string) => {
      const statuses = TAB_FILTERS[key];
      return statuses ? requests.filter((r) => statuses.includes(r.status)).length : requests.length;
    };
    return {
      all: count('all'),
      awaiting: count('awaiting'),
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

  const filteredValue = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered]);

  const resetFilters = () => {
    setSearch('');
    setDept('ALL');
    setCategory('ALL');
    setAmountRange('ANY');
    setDateRange('ANY');
  };

  /** Applied filters, so the reader can see and release each one without hunting. */
  const appliedFilters = useMemo<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    if (search.trim()) list.push({ label: 'Search', value: search.trim(), onClear: () => setSearch('') });
    if (dept !== 'ALL') list.push({ label: 'Dept', value: dept, onClear: () => setDept('ALL') });
    if (category !== 'ALL')
      list.push({
        label: 'Category',
        value: CATEGORY_LABEL[category as Category],
        onClear: () => setCategory('ALL'),
      });
    if (amountRange !== 'ANY')
      list.push({
        label: 'Amount',
        value: AMOUNT_LABEL[amountRange] ?? amountRange,
        onClear: () => setAmountRange('ANY'),
      });
    if (dateRange !== 'ANY')
      list.push({
        label: 'Filed',
        value: DATE_LABEL[dateRange] ?? dateRange,
        onClear: () => setDateRange('ANY'),
      });
    return list;
  }, [search, dept, category, amountRange, dateRange]);

  const selectedTotal = useMemo(
    () => requests.filter((r) => selected.includes(r.id)).reduce((s, r) => s + r.amount, 0),
    [requests, selected],
  );

  /** Of the selection, the ones Accounts is actually allowed to pass. */
  const selectedPassable = useMemo(
    () => requests.filter((r) => selected.includes(r.id) && isHrCleared(r.status)).length,
    [requests, selected],
  );

  const decide = (id: string, status: RequestStatus, note?: string) =>
    updateRequestStatus(id, status, ACC_ACTOR, 'ACCOUNTS', note);

  /**
   * Approving here clears the claim financially and hands it straight to the
   * disbursement screen with that employee preselected. Guarded on HR approval.
   */
  const approveAndPay = (r: ReceiptRequest, note?: string) => {
    if (!isHrCleared(r.status)) return;
    decide(r.id, 'ACC_APPROVED', note);
    navigate(`/pay?employee=${r.employeeId}`);
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

  const columns: Column<ReceiptRequest>[] = [
    {
      key: 'id',
      header: 'Docket',
      width: '172px',
      // Table layout is auto, so the subject line needs a ceiling before `truncate` bites.
      className: 'max-w-[172px]',
      render: (r) => (
        // The docket line as it is written on the voucher: number, then the subject.
        <div className="min-w-0">
          <p className="ku-docket text-rich-black">{r.id}</p>
          <p className="mt-0.5 truncate text-body-s text-light-black" title={r.title}>
            {r.title}
          </p>
        </div>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => {
        const emp = employeeById(r.employeeId);
        return emp ? <EmployeeChip employee={emp} showDept /> : <span className="text-meta">—</span>;
      },
    },
    {
      key: 'amount',
      header: 'Claimed',
      numeric: true,
      render: (r) => (
        <div>
          <span className="font-semibold text-rich-black">{formatCurrency(r.amount)}</span>
          <span className="mt-0.5 block font-sans text-caption text-meta">
            {CATEGORY_LABEL[r.category]}
          </span>
        </div>
      ),
    },
    {
      key: 'cap',
      header: 'Policy cap',
      numeric: true,
      render: (r) => {
        const cap = capFor(r.category, policyCaps);
        if (!cap) return <span className="text-meta">—</span>;
        const over = r.amount - cap.cap;
        // The comparison is the point: cap on top, the breach ruled underneath in red.
        return (
          <div className="inline-block text-right">
            <span className={over > 0 ? 'text-meta' : 'text-rich-black'}>
              {formatCurrency(cap.cap)}
            </span>
            {over > 0 && (
              <span className="mt-0.5 block border-t-2 border-washed pt-0.5 font-sans text-caption font-semibold text-st-red-ink">
                <span className="ku-fig">+{formatCurrency(over)}</span> over
              </span>
            )}
          </div>
        );
      },
    },
    {
      // Both financial exceptions ride in one column: a duplicate receipt, and a claim
      // that would eat more than the department has left. Blank means the claim is clean.
      key: 'flags',
      header: 'Flags',
      render: (r) => {
        const emp = employeeById(r.employeeId);
        const h = headroomFor(departmentUtilisation, emp?.department);
        const overPool = h ? r.amount > h.headroom : false;
        if (!r.duplicateOf && !overPool) {
          return (
            <span className="ku-fig text-meta" title="No exception raised">
              —
            </span>
          );
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {r.duplicateOf && (
              <Badge tone="red">
                <AlertTriangle aria-hidden="true" className="h-3 w-3" />
                Duplicate
              </Badge>
            )}
            {overPool && <Badge tone="amber">Over pool</Badge>}
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => {
        // HARD GATE: no Accounts action until HR has explicitly approved.
        const blocked = accountsBlockedReason(r.status);
        return (
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
            {blocked ? (
              // Locked reads as a stamp on the row, not a greyed-out button.
              <span
                title={blocked}
                className="ku-stamp border-hairline-strong text-meta"
              >
                <Lock aria-hidden="true" className="h-3 w-3" />
                Locked
              </span>
            ) : (
              <>
                <IconButton
                  icon={Check}
                  label={`Pass ${r.id} for payment`}
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    approveAndPay(r);
                  }}
                />
                <IconButton
                  icon={X}
                  label={`Decline ${r.id}`}
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    decide(r.id, 'ACC_REJECTED');
                  }}
                />
              </>
            )}
          </div>
        );
      },
    },
  ];

  const deptColumns: Column<DeptRow>[] = [
    {
      key: 'department',
      header: 'Department',
      render: (d) => (
        <div className="min-w-0">
          <p className="truncate text-body-s font-semibold text-rich-black">{d.department}</p>
          <p className="mt-0.5 text-caption text-meta">
            <span className="ku-fig">{d.headcount}</span> on strength
          </p>
        </div>
      ),
    },
    { key: 'allocated', header: 'Allocated', numeric: true, render: (d) => formatCurrency(d.allocated) },
    { key: 'used', header: 'Drawn', numeric: true, render: (d) => formatCurrency(d.used) },
    { key: 'pending', header: 'In flight', numeric: true, render: (d) => formatCurrency(d.pending) },
    {
      key: 'headroom',
      header: 'Headroom',
      numeric: true,
      render: (d) => {
        const tight = d.headroom < 0.2 * d.allocated;
        return (
          <span className={tight ? 'font-semibold text-st-amber-ink' : 'font-semibold text-rich-black'}>
            {formatCurrency(d.headroom)}
          </span>
        );
      },
    },
    {
      key: 'bar',
      header: 'Committed',
      numeric: false,
      width: '260px',
      render: (d) => (
        <ProgressBar
          height={8}
          total={d.allocated}
          figure={formatPercent((d.used + d.pending) / d.allocated)}
          segments={[
            { value: d.used, className: 'bg-darkey-bluey', label: 'Drawn' },
            { value: d.pending, className: 'bg-orangy', label: 'In flight' },
            { value: d.headroom, className: 'bg-hairline-strong', label: 'Headroom' },
          ]}
        />
      ),
    },
  ];

  const activeEmployee = active ? employeeById(active.employeeId) : undefined;
  const activeCap = active ? capFor(active.category, policyCaps) : undefined;
  const activeBlocked = active ? accountsBlockedReason(active.status) : null;
  const activeHeadroom = headroomFor(departmentUtilisation, activeEmployee?.department);
  /** A void claim is struck through — the record stays legible, the decision does not. */
  const activeVoid = active
    ? active.status === 'ACC_REJECTED' || active.status === 'HR_REJECTED'
    : false;
  const overCapBy = active && activeCap ? Math.max(0, active.amount - activeCap.cap) : 0;

  /** Where the claim actually stands with this desk, once HR has let go of it. */
  const gate = (():
    | { icon: typeof ShieldCheck; rule: string; ink: string; note: string }
    | null => {
    if (!active || activeBlocked) return null;
    if (active.status === 'ACC_REJECTED')
      return {
        icon: XCircle,
        rule: 'border-l-washed',
        ink: 'text-washed',
        note: 'Accounts declined this claim. The record stays on file, and the decision can still be revised.',
      };
    if (active.status === 'PAID' || active.status === 'CREDITED')
      return {
        icon: CheckCircle2,
        rule: 'border-l-st-green-ink',
        ink: 'text-st-green-ink',
        note: 'This claim has already been disbursed against a UTR. Nothing further is owed on it.',
      };
    if (active.status === 'ACC_APPROVED' || active.status === 'PAYMENT_QUEUED')
      return {
        icon: CheckCircle2,
        rule: 'border-l-st-green-ink',
        ink: 'text-st-green-ink',
        note: 'Accounts passed this claim. It is waiting on the next disbursement run.',
      };
    return {
      icon: ShieldCheck,
      rule: 'border-l-st-green-ink',
      ink: 'text-st-green-ink',
      note: 'HR cleared this claim. Accounts holds the next decision.',
    };
  })();
  const receiptWeight = active ? active.receipts.reduce((s, f) => s + f.sizeKb, 0) : 0;

  /** Figures inside a verdict sentence still read on the instrument voice. */
  const fig = (value: string): JSX.Element => <span className="ku-fig text-rich-black">{value}</span>;

  const checklist: { label: string; pass: boolean; verdict: ReactNode }[] = active
    ? [
        {
          label: 'Within category cap',
          pass: activeCap ? active.amount <= activeCap.cap : true,
          verdict: activeCap ? (
            active.amount <= activeCap.cap ? (
              <>Claimed {fig(formatCurrency(active.amount))} against a {fig(formatCurrency(activeCap.cap))} cap</>
            ) : (
              <>
                Over the {fig(formatCurrency(activeCap.cap))} cap by{' '}
                {fig(formatCurrency(active.amount - activeCap.cap))}
              </>
            )
          ) : (
            'No cap is configured for this category'
          ),
        },
        {
          label: 'Receipt on file',
          pass: active.receipts.length > 0,
          verdict:
            active.receipts.length > 0 ? (
              <>
                {fig(String(active.receipts.length))} receipt
                {active.receipts.length === 1 ? '' : 's'} attached, {fig(formatFileSize(receiptWeight))}
              </>
            ) : (
              'Nothing attached — send it back and ask for the bill'
            ),
        },
        {
          label: 'No duplicate claim',
          pass: !active.duplicateOf,
          verdict: active.duplicateOf ? (
            <>Receipt totals match <span className="ku-docket text-rich-black">{active.duplicateOf}</span></>
          ) : (
            'No other claim matches this receipt'
          ),
        },
        {
          label: 'Within monthly allowance',
          pass: activeEmployee
            ? activeEmployee.usedThisMonth + activeEmployee.pendingAmount <=
              activeEmployee.monthlyAllowance
            : true,
          verdict: activeEmployee ? (
            activeEmployee.usedThisMonth + activeEmployee.pendingAmount <=
            activeEmployee.monthlyAllowance ? (
              <>
                {fig(formatCurrency(activeEmployee.usedThisMonth + activeEmployee.pendingAmount))}{' '}
                committed of {fig(formatCurrency(activeEmployee.monthlyAllowance))}
              </>
            ) : (
              <>
                Past the {fig(formatCurrency(activeEmployee.monthlyAllowance))} monthly pool — the
                overrun needs Accounts to clear it
              </>
            )
          ) : (
            '—'
          ),
        },
      ]
    : [];

  const budgetLegend: { label: string; value: number; className: string }[] = [
    { label: 'Drawn', value: budget.used, className: 'bg-darkey-bluey' },
    { label: 'In flight', value: budget.pending, className: 'bg-orangy' },
    { label: 'Headroom', value: budget.headroom, className: 'bg-hairline-strong' },
  ];

  const tabEmpty = TAB_EMPTY[tab] ?? TAB_EMPTY.all;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts Portal"
        subtitle="Second-level review. Every HR-cleared claim is checked against its policy cap and the department pool before it is passed for payment."
        breadcrumb={[{ label: 'Home', to: '/overview' }, { label: 'Accounts Portal' }]}
      />

      <LedgerBand cols={4}>
        <StatCard
          label="On this desk"
          value={formatCurrency(kpis.awaitingValue)}
          sublabel={`${kpis.awaitingCount} claims`}
          icon={Inbox}
          tone="orange"
        />
        <StatCard
          label="Passed for payment"
          value={formatCurrency(kpis.queuedValue)}
          sublabel={`${kpis.queuedCount} claims`}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Over policy cap"
          value={String(kpis.overCapCount)}
          sublabel={`of ${requests.length} on file`}
          icon={XCircle}
        />
        <StatCard
          label="Duplicate flags"
          value={String(kpis.duplicateCount)}
          sublabel="matched on receipt totals"
          icon={Copy}
          tone="danger"
        />
      </LedgerBand>

      {/* Budget position — the financial frame that distinguishes this portal from HR's queue. */}
      <Card>
        <CardHeader
          eyebrow="Allowance pools"
          title="Budget position"
          subtitle="What every department has committed against its allocation this month"
          action={
            <span className="text-body-s text-meta">
              Headroom{' '}
              <span className="ku-total text-body">{formatCurrency(budget.headroom)}</span>{' '}
              of <span className="ku-fig text-rich-black">{formatCurrency(budget.allocated)}</span>
            </span>
          }
        />
        <CardBody>
          <ProgressBar
            height={14}
            total={budget.allocated}
            figure={formatPercent((budget.used + budget.pending) / budget.allocated)}
            segments={budgetLegend.map((l) => ({
              value: l.value,
              className: l.className,
              label: l.label,
            }))}
          />
          <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
            {budgetLegend.map((item) => (
              <span key={item.label} className="flex items-baseline gap-2">
                <span aria-hidden="true" className={cx('h-2.5 w-2.5 shrink-0 self-center', item.className)} />
                <span className="text-body-s text-light-black">{item.label}</span>
                <span className="ku-fig text-body-s font-semibold text-rich-black">
                  {formatCurrency(item.value)}
                </span>
              </span>
            ))}
          </div>
        </CardBody>
        <DataTable
          columns={deptColumns}
          rows={deptRows}
          rowKey={(d) => d.department}
          dense
          stickyHeader={false}
        />
      </Card>

      <div>
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All claims', count: tabCounts.all },
            { key: 'awaiting', label: 'On this desk', count: tabCounts.awaiting },
            { key: 'info', label: 'Query raised', count: tabCounts.info },
            { key: 'approved', label: 'Passed for payment', count: tabCounts.approved },
            { key: 'rejected', label: 'Declined', count: tabCounts.rejected },
          ]}
        />

        {/* Filter rail and ledger are welded into one sheet — one border, not two cards. */}
        <FilterBar
          className="mt-6"
          flush
          onReset={resetFilters}
          filters={appliedFilters}
        >
          <Field label="Search" className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Docket, title or employee"
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
          <Field label="Amount" className="min-w-[160px]">
            <Select value={amountRange} onChange={(e) => setAmountRange(e.target.value)}>
              <option value="ANY">Any amount</option>
              <option value="LOW">Under 5,000</option>
              <option value="MID">5,000 – 20,000</option>
              <option value="HIGH">Over 20,000</option>
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

        <div className="ku-card border-t-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline-strong px-4 py-3 sm:px-5">
            <h3 className="ku-wide font-display text-lead font-semibold leading-tight text-rich-black">
              Claim ledger
            </h3>
            <p className="text-caption text-meta">
              <span className="ku-fig text-rich-black">{filtered.length}</span> of{' '}
              <span className="ku-fig">{requests.length}</span> claims ·{' '}
              <span className="ku-total text-body-s">{formatCurrency(filteredValue)}</span>
            </p>
          </div>

          {selected.length > 0 && (
            <div className="sticky top-16 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 border-l-6 border-l-orangy bg-darkey-bluey px-4 py-3 text-white animate-fade-rise">
              <span className="text-body-s">
                <span className="ku-fig font-semibold">{selected.length}</span> selected ·{' '}
                <span className="ku-fig font-semibold">{formatCurrency(selectedTotal)}</span>
              </span>
              {selectedPassable < selected.length && (
                <span className="flex items-center gap-2 text-caption text-white/80">
                  <Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span className="ku-fig">{selected.length - selectedPassable}</span> not cleared by
                  HR — they will be left where they are
                </span>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    // Silently skipping is wrong — only HR-cleared claims are approvable.
                    selected.forEach((id) => {
                      const r = requests.find((x) => x.id === id);
                      if (r && isHrCleared(r.status)) decide(id, 'ACC_APPROVED');
                    });
                    setSelected([]);
                  }}
                >
                  Pass <span className="ku-fig">{selectedPassable}</span> for payment
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
          )}

          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            dense
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            onRowClick={(r) => setActive(r)}
            empty={
              appliedFilters.length > 0 ? (
                <EmptyState
                  eyebrow="Filtered out"
                  title="No claims match these filters"
                  description="Widen the amount or date range, or clear the filters to bring the whole ledger back."
                  action={
                    <Button variant="outline" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  eyebrow="Desk clear"
                  title={tabEmpty.title}
                  description={tabEmpty.description}
                />
              )
            }
          />
        </div>
      </div>

      <Drawer
        open={Boolean(active)}
        onClose={closeDrawer}
        eyebrow="Claim under review"
        title={active ? active.title : ''}
        docket={active ? active.id : undefined}
        subtitle={active ? `${CATEGORY_LABEL[active.category]} claim, second-level review` : undefined}
        width="xl"
        footer={
          activeBlocked ? (
            <div className="flex w-full items-start gap-3 border-l-6 border-l-st-amber-ink bg-white px-4 py-3">
              <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-st-amber-ink" />
              <div className="min-w-0">
                <p className="ku-eyebrow text-st-amber-ink">No Accounts action available</p>
                <p className="mt-1 text-body-s text-light-black">{activeBlocked}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="success"
                icon={Check}
                onClick={() => {
                  if (!active) return;
                  const note = comment.trim() || undefined;
                  closeDrawer();
                  approveAndPay(active, note);
                }}
              >
                Pass for payment
              </Button>
              <Button
                variant="outline"
                icon={CornerUpLeft}
                onClick={() => drawerDecide('HR_APPROVED')}
              >
                Send back to HR
              </Button>
              <Button variant="danger" icon={X} onClick={() => drawerDecide('ACC_REJECTED')}>
                Decline claim
              </Button>
            </div>
          )
        }
      >
        {active && (
          <div className="space-y-7">
            {/* The voucher. Docket at the head, the amount as the anchor figure, the verdict stamped. */}
            <section className={cx('relative ku-sheet', activeVoid && 'border-t-washed')}>
              {activeVoid && (
                <span
                  aria-hidden="true"
                  className="ku-hatch pointer-events-none absolute inset-0 text-washed opacity-20"
                />
              )}

              <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-5 pb-4 pt-4">
                <div className="min-w-0">
                  <p className="ku-eyebrow">Amount claimed</p>
                  <p className="ku-total mt-2 text-figure leading-none sm:text-figure-lg">
                    {formatCurrency(active.amount)}
                  </p>
                  <p className="mt-2.5 text-body-s text-meta">
                    Filed{' '}
                    <span className="ku-fig text-rich-black">{formatDate(active.submittedOn)}</span>
                    {active.travelDates ? (
                      <>
                        {' · travel '}
                        <span className="ku-fig text-rich-black">
                          {formatDateRange(active.travelDates)}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2.5">
                  {activeVoid ? (
                    <Stamp label="Void" tone="red" />
                  ) : (
                    <StatusBadge status={active.status} size="md" />
                  )}
                  <span className="ku-docket text-rich-black">{active.id}</span>
                </div>
              </div>

              {activeEmployee && (
                <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-5 py-3">
                  <Avatar name={activeEmployee.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-body-s font-semibold text-rich-black">
                      {activeEmployee.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-caption text-meta">
                      <span className="ku-docket">{activeEmployee.employeeCode}</span>
                      <span>
                        {activeEmployee.designation}, {activeEmployee.department}
                      </span>
                    </p>
                  </div>
                  <span className="ml-auto text-caption text-meta">
                    Reports to{' '}
                    <span className="text-rich-black">{activeEmployee.managerName}</span>
                  </span>
                </div>
              )}
            </section>

            {/* The HR gate. Blocked is structural: the reason, and what has to happen first. */}
            {activeBlocked ? (
              <section className="border-3 border-st-amber-ink bg-white">
                <div className="flex items-start gap-3 px-4 py-4">
                  <Lock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-st-amber-ink" />
                  <div className="min-w-0">
                    <p className="ku-eyebrow text-st-amber-ink">Locked to Accounts</p>
                    <p className="mt-2 font-display text-body font-semibold text-rich-black">
                      {activeBlocked}
                    </p>
                    <p className="mt-1.5 text-body-s text-light-black">
                      Accounts may pass, query or decline a claim only after HR clears it. Until
                      then this panel is a read-only record — nothing on it can be actioned.
                    </p>
                  </div>
                </div>
              </section>
            ) : gate ? (
              <p
                className={cx(
                  'flex items-start gap-2.5 border-l-3 py-1 pl-3 text-body-s text-light-black',
                  gate.rule,
                )}
              >
                <gate.icon aria-hidden="true" className={cx('mt-0.5 h-4 w-4 shrink-0', gate.ink)} />
                {gate.note}
              </p>
            ) : null}

            {/* A duplicate is the loudest financial signal on this desk, so it takes the red rule. */}
            {active.duplicateOf && (
              <section className="border-2 border-washed bg-white">
                <div className="flex items-center gap-2.5 border-b-2 border-washed px-4 py-2">
                  <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-washed" />
                  <p className="ku-eyebrow text-st-red-ink">Possible duplicate</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3.5">
                  <p className="min-w-0 text-body-s text-light-black">
                    The receipt totals on this claim match docket{' '}
                    <span className="ku-docket text-rich-black">{active.duplicateOf}</span>. Pay
                    both and the plant pays the same bill twice.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Copy}
                    onClick={() => {
                      const target = active.duplicateOf;
                      closeDrawer();
                      if (target) navigate(`/requests/${target}`);
                    }}
                  >
                    Compare with <span className="ku-fig">{active.duplicateOf}</span>
                  </Button>
                </div>
              </section>
            )}

            {/* The cap check: claimed against cap, hard-edged, with the breach ruled in red. */}
            {activeCap && (
              <PanelSection title="Policy cap" meta={`${activeCap.label} · ${activeCap.unit}`}>
                <div
                  className={cx(
                    'border border-hairline bg-white',
                    overCapBy > 0 ? 'border-t-3 border-t-washed' : 'border-t-3 border-t-darkey-bluey',
                  )}
                >
                  <div className="grid grid-cols-3">
                    <div className="px-4 py-3">
                      <p className="ku-eyebrow">Claimed</p>
                      <p className="ku-total mt-1.5 text-body leading-none sm:text-lead">
                        {formatCurrency(active.amount)}
                      </p>
                    </div>
                    <div className="border-l border-hairline px-4 py-3">
                      <p className="ku-eyebrow">Cap</p>
                      <p className="ku-fig mt-1.5 text-body font-semibold leading-none text-meta sm:text-lead">
                        {formatCurrency(activeCap.cap)}
                      </p>
                    </div>
                    <div className="border-l border-hairline px-4 py-3">
                      <p className="ku-eyebrow">{overCapBy > 0 ? 'Over by' : 'Under by'}</p>
                      <p
                        className={cx(
                          'ku-fig mt-1.5 text-body font-semibold leading-none sm:text-lead',
                          overCapBy > 0 ? 'text-st-red-ink' : 'text-st-green-ink',
                        )}
                      >
                        {overCapBy > 0
                          ? `+${formatCurrency(overCapBy)}`
                          : formatCurrency(activeCap.cap - active.amount)}
                      </p>
                    </div>
                  </div>

                  {/* One ruled bar: navy to the cap, red past it, with a hard tick on the line. */}
                  <div className="border-t border-hairline px-4 py-3.5">
                    <div
                      role="img"
                      aria-label={`Claimed ${formatCurrency(active.amount)} against a cap of ${formatCurrency(activeCap.cap)}`}
                      className="relative flex h-3 w-full gap-px overflow-hidden bg-canvas-deep"
                    >
                      <div
                        className="origin-left animate-rule-in bg-darkey-bluey"
                        style={{
                          width: `${(Math.min(active.amount, activeCap.cap) / Math.max(active.amount, activeCap.cap)) * 100}%`,
                        }}
                      />
                      {overCapBy > 0 && (
                        <>
                          <div
                            className="origin-left animate-rule-in bg-washed"
                            style={{ width: `${(overCapBy / active.amount) * 100}%` }}
                          />
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-0 w-0.5 bg-rich-black"
                            style={{ left: `${(activeCap.cap / active.amount) * 100}%` }}
                          />
                        </>
                      )}
                    </div>
                    <p className="mt-2 text-caption text-meta">
                      {overCapBy === 0
                        ? `This claim sits inside the ${activeCap.label.toLowerCase()} for ${CATEGORY_LABEL[active.category].toLowerCase()}.`
                        : activeBlocked
                          ? 'The overrun will need a reason on record before Accounts can pass this claim.'
                          : 'Passing this claim commits the plant to the overrun. Record why in the decision note.'}
                    </p>
                  </div>
                </div>
              </PanelSection>
            )}

            {/* The four checks Accounts signs off on, ruled — no tint washes. */}
            <PanelSection
              title="Policy checks"
              meta={
                <>
                  <span className="ku-fig">
                    {checklist.filter((c) => c.pass).length}/{checklist.length}
                  </span>{' '}
                  clear
                </>
              }
            >
              <ul className="ku-ruled border border-hairline bg-white">
                {checklist.map((item, i) => (
                  <li
                    key={item.label}
                    className={cx(
                      'flex items-start gap-3 border-l-3 px-4 py-3',
                      item.pass ? 'border-l-st-green-ink' : 'border-l-st-amber-ink',
                    )}
                  >
                    <span className="ku-fig w-5 shrink-0 pt-0.5 text-micro text-meta">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-s font-semibold text-rich-black">{item.label}</p>
                      <p className="mt-0.5 text-caption text-meta">{item.verdict}</p>
                    </div>
                    <span
                      className={cx(
                        'ku-stamp shrink-0',
                        item.pass
                          ? 'border-st-green-line text-st-green-ink'
                          : 'border-st-amber-line text-st-amber-ink',
                      )}
                    >
                      {item.pass ? 'Clear' : 'Check'}
                    </span>
                  </li>
                ))}
              </ul>
            </PanelSection>

            {activeEmployee && (
              <PanelSection title="Employee allowance">
                <AllowanceCard employee={activeEmployee} compact />
              </PanelSection>
            )}

            {activeHeadroom && (
              <PanelSection title="Department pool" meta={activeHeadroom.row.department}>
                <div className="border border-hairline bg-white">
                  <div className="grid grid-cols-2 sm:grid-cols-4">
                    {[
                      { label: 'Allocated', value: activeHeadroom.row.allocated },
                      { label: 'Drawn', value: activeHeadroom.row.used },
                      { label: 'In flight', value: activeHeadroom.row.pending },
                      { label: 'Headroom', value: activeHeadroom.headroom },
                    ].map((cell, i) => (
                      <div
                        key={cell.label}
                        className={cx(
                          // 2x2 below sm, one ruled row above it: hairlines divide, gaps never do.
                          'border-hairline px-4 py-3',
                          i === 1 || i === 3 ? 'border-l' : i === 2 ? 'sm:border-l' : '',
                          i > 1 ? 'border-t sm:border-t-0' : '',
                        )}
                      >
                        <p className="ku-eyebrow">{cell.label}</p>
                        <p
                          className={cx(
                            'mt-1.5 text-body leading-none',
                            cell.label === 'Headroom' ? 'ku-total' : 'ku-fig font-semibold text-light-black',
                          )}
                        >
                          {formatCurrency(cell.value)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-hairline px-4 py-3.5">
                    <ProgressBar
                      total={activeHeadroom.row.allocated}
                      figure={formatPercent(
                        (activeHeadroom.row.used + activeHeadroom.row.pending) /
                          activeHeadroom.row.allocated,
                      )}
                      segments={[
                        { value: activeHeadroom.row.used, className: 'bg-darkey-bluey', label: 'Drawn' },
                        {
                          value: activeHeadroom.row.pending,
                          className: 'bg-orangy',
                          label: 'In flight',
                        },
                        {
                          value: activeHeadroom.headroom,
                          className: 'bg-hairline-strong',
                          label: 'Headroom',
                        },
                      ]}
                    />
                    {active.amount > activeHeadroom.headroom && (
                      <p className="mt-3 flex items-start gap-2 border-l-3 border-l-st-amber-ink pl-3 text-body-s text-st-amber-ink">
                        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          This claim runs{' '}
                          <span className="ku-fig font-semibold">
                            {formatCurrency(active.amount - activeHeadroom.headroom)}
                          </span>{' '}
                          past what {activeHeadroom.row.department} has left this month.
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </PanelSection>
            )}

            <PanelSection title="Claim record">
              <dl className="ku-ruled border border-hairline bg-white">
                <RecordRow term="Docket">
                  <span className="ku-docket text-rich-black">{active.id}</span>
                </RecordRow>
                <RecordRow term="Category">{CATEGORY_LABEL[active.category]}</RecordRow>
                <RecordRow term="Travel dates">
                  <span className="ku-fig">{formatDateRange(active.travelDates)}</span>
                </RecordRow>
                <RecordRow term="Filed on">
                  <span className="ku-fig">{formatDateTime(active.submittedOn)}</span>
                </RecordRow>
                <RecordRow term="Stage">
                  <StatusBadge status={active.status} />
                </RecordRow>
              </dl>
            </PanelSection>

            <PanelSection title="Why it was claimed">
              <p className="ku-rule-accent py-1 text-body leading-relaxed text-light-black">
                {active.justification}
              </p>
            </PanelSection>

            <PanelSection
              title="Receipt evidence"
              meta={
                active.receipts.length > 0 ? (
                  <>
                    <span className="ku-fig">{active.receipts.length}</span> file
                    {active.receipts.length === 1 ? '' : 's'} ·{' '}
                    <span className="ku-fig">{formatFileSize(receiptWeight)}</span>
                  </>
                ) : undefined
              }
            >
              {active.receipts.length > 0 ? (
                <ReceiptGrid receipts={active.receipts} columns={2} onPreview={setLightbox} />
              ) : (
                <div className="border border-hairline bg-white">
                  <EmptyState
                    compact
                    eyebrow="No receipt"
                    title="Nothing is attached to this claim"
                    description="Send it back to the employee and ask for the bill before you pass any amount."
                  />
                </div>
              )}
            </PanelSection>

            <PanelSection
              title="Audit trail"
              meta={
                <>
                  <span className="ku-fig">{active.timeline.length}</span>{' '}
                  {active.timeline.length === 1 ? 'entry' : 'entries'}
                </>
              }
            >
              <Timeline events={active.timeline} />
            </PanelSection>

            {activeBlocked ? (
              // The decision surface itself is withdrawn, not greyed — there is nothing to record.
              <section className="border border-hairline border-l-6 border-l-hairline-strong bg-canvas px-4 py-3.5">
                <p className="ku-eyebrow">Decision note</p>
                <p className="mt-2 flex items-start gap-2 text-body-s text-light-black">
                  <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-meta" />
                  <span>
                    No note can be recorded while this claim is locked. The decision surface
                    reopens on this desk the moment HR clears it.
                  </span>
                </p>
              </section>
            ) : (
              <Field
                label="Decision note"
                hint="Recorded on the claim’s audit trail against your name."
              >
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Why this amount passes, or what has to change before it can"
                />
              </Field>
            )}
          </div>
        )}
      </Drawer>

      <ReceiptLightbox receipt={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
