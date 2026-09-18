import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Paperclip, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, StagePill, StatusBadge } from '@/components/ui/StatusBadge';
import { LedgerBand, StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { ProgressSegment } from '@/components/ui/ProgressBar';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { useApp } from '@/context/AppContext';
import type { Category, RequestStatus } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_LABEL, TONE_CLASSES, statusTone } from '@/lib/status';
import {
  DEMO_TODAY,
  cx,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatPercent,
} from '@/lib/format';

const TAB_FILTERS: Record<string, RequestStatus[] | null> = {
  all: null,
  progress: ['SUBMITTED', 'HR_APPROVED', 'ACC_APPROVED', 'PAYMENT_QUEUED'],
  action: ['DRAFT', 'HR_INFO_REQUESTED', 'ACC_INFO_REQUESTED'],
  approved: ['PAID', 'CREDITED'],
  rejected: ['HR_REJECTED', 'ACC_REJECTED'],
};

/** The standfirst over the ledger — names the pile, never restates the tab. */
const TAB_HEADING: Record<string, string> = {
  all: 'Everything you have filed this month',
  progress: 'Sitting with an approver',
  action: 'Waiting on you',
  approved: 'Settled and credited',
  rejected: 'Refused',
};

/** An empty pile is an invitation to file, not an apology for being empty. */
const TAB_EMPTY: Record<string, { eyebrow: string; title: string; description: string }> = {
  all: {
    eyebrow: 'Nothing on file',
    title: 'File your first claim',
    description:
      'Attach the receipt or a pro-forma estimate and file it. HR checks the business need, Accounts passes it for payment, and the money lands in your bank account against a UTR.',
  },
  progress: {
    eyebrow: 'Nothing in flight',
    title: 'No claim is with an approver',
    description:
      'Anything you file sits here while HR and Accounts work through it, with the desk that holds it shown on every row.',
  },
  action: {
    eyebrow: 'Nothing waiting',
    title: 'Nothing is waiting on you',
    description:
      'Drafts you have not filed, and claims where an approver has raised a query, collect here so you can clear them in one pass.',
  },
  approved: {
    eyebrow: 'Nothing settled',
    title: 'No claim has settled yet',
    description:
      'Once Accounts releases a payment, the claim lands here with its UTR and the date it was credited.',
  },
  rejected: {
    eyebrow: 'Nothing refused',
    title: 'No claim has been refused',
    description: 'A refused claim stays on file with the note the approver sent you.',
  },
};

const INITIAL_FILES = [
  { id: 'f1', fileName: 'indigo-6E2043-boarding.pdf', sizeKb: 412 },
  { id: 'f2', fileName: 'taj-vivanta-invoice.jpg', sizeKb: 1180 },
];

const EMPTY_FORM = {
  title: '',
  category: 'TRAVEL',
  amount: '',
  from: '',
  to: '',
  justification: '',
};

export default function MyRequests() {
  const navigate = useNavigate();
  // TODO: replace with API call
  const { requests, currentEmployee, createRequest } = useApp();

  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [draftFiles, setDraftFiles] = useState(INITIAL_FILES);

  const mine = useMemo(
    () => requests.filter((r) => r.employeeId === currentEmployee.id),
    [requests, currentEmployee.id],
  );

  const counts = useMemo(() => {
    const count = (key: string) => {
      const statuses = TAB_FILTERS[key];
      return statuses ? mine.filter((r) => statuses.includes(r.status)).length : mine.length;
    };
    return {
      all: count('all'),
      progress: count('progress'),
      action: count('action'),
      approved: count('approved'),
      rejected: count('rejected'),
      claimed: mine.reduce((s, r) => s + r.amount, 0),
    };
  }, [mine]);

  const visible = useMemo(() => {
    const statuses = TAB_FILTERS[tab];
    const list = statuses ? mine.filter((r) => statuses.includes(r.status)) : mine;
    return [...list].sort(
      (a, b) => new Date(b.submittedOn).getTime() - new Date(a.submittedOn).getTime(),
    );
  }, [mine, tab]);

  const visibleValue = useMemo(() => visible.reduce((s, r) => s + r.amount, 0), [visible]);

  const { monthlyAllowance, usedThisMonth, pendingAmount } = currentEmployee;
  const remaining = Math.max(0, monthlyAllowance - usedThisMonth - pendingAmount);
  const isLow = remaining < 0.2 * monthlyAllowance;
  const amountNumber = Number(form.amount) || 0;
  // Filing a claim puts money in flight, so it takes the pool down, not up.
  const afterClaim = remaining - amountNumber;

  const poolSegments: ProgressSegment[] = [
    { value: usedThisMonth, className: 'bg-darkey-bluey', label: 'Disbursed' },
    { value: pendingAmount, className: 'bg-orangy', label: 'In flight' },
    { value: remaining, className: 'bg-hairline-strong', label: 'Available' },
  ];

  const closeModal = () => {
    setOpen(false);
    setForm(EMPTY_FORM);
    setDraftFiles(INITIAL_FILES);
  };

  /**
   * Files the claim into shared state. There is no validation by design — an empty
   * form still produces a record, it just reads as an unnamed draft.
   */
  const fileRequest = (status: 'DRAFT' | 'SUBMITTED') => {
    const id = createRequest({
      employeeId: currentEmployee.id,
      title: form.title.trim() || 'Untitled claim',
      category: form.category as Category,
      amount: Number(form.amount) || 0,
      justification: form.justification.trim() || 'No justification provided.',
      travelDates: form.from && form.to ? { from: form.from, to: form.to } : undefined,
      files: draftFiles.map((f) => ({ fileName: f.fileName, sizeKb: f.sizeKb })),
      status,
      actor: currentEmployee.name,
    });
    closeModal();
    setTab(status === 'DRAFT' ? 'action' : 'progress');
    navigate(`/requests/${id}`);
  };

  return (
    <div>
      <PageHeader
        title="My claims"
        subtitle={`Everything ${currentEmployee.name} has filed against the monthly allowance pool, from draft through to the credited UTR.`}
        breadcrumb={[{ label: 'Home', to: '/overview' }, { label: 'Requests' }]}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
            File a claim
          </Button>
        }
      />

      {/*
        The allowance position: allocated, spent, in flight, left — one ruled band.
        One account, so one tone rules the whole band. Colour is spent on the single
        cell that is genuinely exceptional: the pool running down past four fifths.
      */}
      <LedgerBand cols={4}>
        <StatCard
          label="Allowance pool"
          value={formatCurrency(monthlyAllowance)}
          sublabel="allocated this month"
          tone="navy"
        />
        <StatCard
          label="Disbursed"
          value={formatCurrency(usedThisMonth)}
          sublabel={
            <>
              <span className="ku-fig">{counts.approved}</span>{' '}
              {counts.approved === 1 ? 'claim' : 'claims'} credited
            </>
          }
          tone="navy"
        />
        <StatCard
          label="In flight"
          value={formatCurrency(pendingAmount)}
          sublabel={
            <>
              <span className="ku-fig">{counts.progress}</span> with approvers
            </>
          }
          tone="navy"
        />
        <StatCard
          label="Still available"
          value={formatCurrency(remaining)}
          sublabel={
            <>
              <span className="ku-fig">{formatPercent(usedThisMonth / monthlyAllowance)}</span> of
              pool used
            </>
          }
          tone={isLow ? 'danger' : 'navy'}
        />
      </LedgerBand>

      {/* The same four numbers as one bar, so the split is readable at a glance. */}
      <div className="border border-t-0 border-hairline bg-white px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span className="ku-eyebrow">Pool utilisation</span>
          <span className="text-caption text-meta">
            as at <span className="ku-fig">{formatDate(DEMO_TODAY)}</span>
          </span>
        </div>

        <ProgressBar segments={poolSegments} total={monthlyAllowance} height={10} className="mt-3" />

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {poolSegments.map((segment) => (
            <span key={segment.label} className="flex items-center gap-2">
              <span aria-hidden="true" className={cx('h-2.5 w-2.5 shrink-0', segment.className)} />
              <span className="text-caption text-meta">{segment.label}</span>
              <span className="ku-fig text-caption font-semibold text-rich-black">
                {formatCurrency(segment.value)}
              </span>
            </span>
          ))}
        </div>

        {isLow && (
          <p className="mt-4 border-l-3 border-st-amber-ink pl-3 text-body-s text-st-amber-ink">
            Under a fifth of the pool is left. Anything you file beyond{' '}
            <span className="ku-fig font-semibold">{formatCurrency(remaining)}</span> needs your
            manager to approve the overrun.
          </p>
        )}
      </div>

      {/* The claim ledger. Ruled rows, one entry per line, the stage visible on every row. */}
      <section className="ku-sheet mt-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <p className="ku-eyebrow">Claim ledger</p>
            <h2 className="ku-wide mt-1.5 font-display text-h3 font-semibold text-rich-black">
              {TAB_HEADING[tab]}
            </h2>
          </div>

          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div>
              <dt className="ku-eyebrow">On view</dt>
              <dd className="ku-fig mt-0.5 text-body font-semibold text-rich-black">
                {visible.length}
              </dd>
            </div>
            <div>
              <dt className="ku-eyebrow">Value on view</dt>
              <dd className="ku-fig mt-0.5 text-body font-semibold text-rich-black">
                {formatCurrency(visibleValue)}
              </dd>
            </div>
            <div>
              <dt className="ku-eyebrow">Filed this month</dt>
              <dd className="ku-fig mt-0.5 text-body font-semibold text-rich-black">
                {formatCurrency(counts.claimed)}
              </dd>
            </div>
          </dl>
        </div>

        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'progress', label: 'In flight', count: counts.progress },
            { key: 'action', label: 'Needs you', count: counts.action },
            { key: 'approved', label: 'Settled', count: counts.approved },
            { key: 'rejected', label: 'Refused', count: counts.rejected },
          ]}
          className="px-1"
        />

        {visible.length === 0 ? (
          <EmptyState
            eyebrow={TAB_EMPTY[tab].eyebrow}
            title={TAB_EMPTY[tab].title}
            description={TAB_EMPTY[tab].description}
            action={
              <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
                File a claim
              </Button>
            }
          />
        ) : (
          <ul className="ku-ruled ku-stagger">
            {visible.map((r, index) => {
              const needsAction =
                r.status === 'HR_INFO_REQUESTED' || r.status === 'ACC_INFO_REQUESTED';
              const lastComment = [...r.timeline].reverse().find((e) => e.comment)?.comment;
              return (
                <li
                  key={r.id}
                  style={{ '--i': index } as React.CSSProperties}
                  className="bg-white transition-colors duration-150 hover:bg-canvas"
                >
                  <Link to={`/requests/${r.id}`} className="flex items-stretch">
                    {/* The tone spine: which desk state this entry is in, read down the margin. */}
                    <span
                      aria-hidden="true"
                      className={cx('w-1 shrink-0', TONE_CLASSES[statusTone(r.status)].solid)}
                    />

                    <div className="flex flex-1 flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                          <span className="ku-docket">{r.id}</span>
                          <span className="ku-wide font-display text-body font-semibold text-rich-black">
                            {r.title}
                          </span>
                          <Badge>{CATEGORY_LABEL[r.category]}</Badge>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-s text-meta">
                          <span>
                            Filed <span className="ku-fig">{formatDate(r.submittedOn)}</span>
                          </span>
                          <span className="ku-fig">{formatDateRange(r.travelDates)}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
                            <span className="ku-fig">{r.receipts.length}</span>
                            {r.receipts.length === 1 ? 'receipt' : 'receipts'}
                          </span>
                        </div>
                      </div>

                      <span className="ku-total shrink-0 text-h3 sm:w-36 sm:text-right">
                        {formatCurrency(r.amount)}
                      </span>

                      <span className="flex shrink-0 flex-col items-start gap-1.5 sm:w-[172px] sm:items-end">
                        <StatusBadge status={r.status} />
                        <StagePill stage={r.currentStage} />
                      </span>

                      <ChevronRight
                        aria-hidden="true"
                        className="hidden h-4 w-4 shrink-0 text-hairline-strong sm:block"
                      />
                    </div>
                  </Link>

                  {needsAction && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-hairline border-l-3 border-l-st-amber-ink bg-st-amber-bg px-4 py-2.5">
                      <AlertTriangle
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-st-amber-ink"
                      />
                      <p className="min-w-0 flex-1 text-body-s text-st-amber-ink">
                        {lastComment ?? 'An approver needs more detail before this can move on.'}
                      </p>
                      <Button variant="primary" size="sm" onClick={() => navigate(`/requests/${r.id}`)}>
                        Answer the query
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={open}
        onClose={closeModal}
        title="File a reimbursement claim"
        subtitle="Attach the receipt or a pro-forma estimate. HR checks the business need before Accounts passes it for payment."
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => fileRequest('DRAFT')}>
              Save as draft
            </Button>
            <Button variant="primary" onClick={() => fileRequest('SUBMITTED')}>
              File claim
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <Field label="Claim title" htmlFor="req-title" required>
            <Input
              id="req-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Client visit — Pune, 3 days"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="req-cat" required>
              <Select
                id="req-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Amount claimed" htmlFor="req-amount" required>
              <div className="relative">
                <span className="ku-fig pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-meta">
                  ₹
                </span>
                <Input
                  id="req-amount"
                  type="number"
                  className="ku-fig pl-7"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="18400"
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Travel from" htmlFor="req-from">
              <Input
                id="req-from"
                type="date"
                className="ku-fig"
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
              />
            </Field>
            <Field label="Travel to" htmlFor="req-to">
              <Input
                id="req-to"
                type="date"
                className="ku-fig"
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Justification"
            htmlFor="req-just"
            required
            hint="Name the business need in one or two sentences. HR reads this first."
          >
            <Textarea
              id="req-just"
              rows={4}
              value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
              placeholder="Three-day on-site with the client to close the Q3 renewal."
            />
          </Field>

          <Field label="Receipts">
            <FileDropzone
              files={draftFiles}
              onRemove={(id) => setDraftFiles((f) => f.filter((x) => x.id !== id))}
              onAdd={(added) =>
                setDraftFiles((f) => [
                  ...f,
                  ...added.map((a, i) => ({ ...a, id: `f-${f.length + i}-${a.fileName}` })),
                ])
              }
            />
          </Field>

          {/* What filing this does to the pool, worked through like a ledger posting. */}
          <div className="border border-t-3 border-hairline border-t-darkey-bluey bg-white px-4 py-3.5">
            <p className="ku-eyebrow">Allowance impact</p>
            <dl className="ku-ruled mt-2.5">
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-body-s text-meta">Available before this claim</dt>
                <dd className="ku-fig text-body-s font-semibold text-rich-black">
                  {formatCurrency(remaining)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-body-s text-meta">This claim</dt>
                <dd className="ku-fig text-body-s font-semibold text-rich-black">
                  − {formatCurrency(amountNumber)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-body-s font-semibold text-rich-black">Left after filing</dt>
                <dd
                  className={cx(
                    'ku-total text-body',
                    afterClaim < 0 ? 'text-st-red-ink' : 'text-rich-black',
                  )}
                >
                  {formatCurrency(Math.max(0, afterClaim))}
                </dd>
              </div>
            </dl>

            {afterClaim < 0 && (
              <p className="mt-3 border-l-3 border-washed pl-3 text-body-s text-st-red-ink">
                This claim runs{' '}
                <span className="ku-fig font-semibold">{formatCurrency(Math.abs(afterClaim))}</span>{' '}
                past your remaining allowance. You can still file it — HR will have to approve the
                overrun.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
