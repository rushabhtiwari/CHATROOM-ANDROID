import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, FileText, Info } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import {
  Badge,
  PayoutBadge,
  SlaChip,
  StagePill,
  Stamp,
  StatusBadge,
} from '@/components/ui/StatusBadge';
import { LedgerBand, StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Stepper, buildRequestSteps } from '@/components/ui/Stepper';
import { Timeline } from '@/components/ui/Timeline';
import { ReceiptLightbox } from '@/components/ui/FileDropzone';
import { AllowanceCard, ProgressBar } from '@/components/ui/ProgressBar';
import { useApp } from '@/context/AppContext';
import type { ReceiptFile, RequestStatus, Role } from '@/lib/types';
import { CATEGORY_LABEL, ROLE_LABEL, actionOwner, isTerminal, statusMeta } from '@/lib/status';
import {
  cx,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatFileSize,
  maskAccount,
} from '@/lib/format';
import { exportRequestPdf } from '@/lib/pdf';

const ACTORS: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  HR: 'Meera Nair',
  ACCOUNTS: 'Vikram Sethi',
  PAYMENTS: 'Kavya Reddy',
  ADMIN: 'Admin',
};

/*
  One claim, set as the docket it would be on paper.

  The page opens with the artifact head: the docket number, the claimed amount as the
  anchor figure, and the verdict struck across it as a stamp — the one struck stamp this
  page is allowed. A void docket (refused by HR or by Accounts) additionally carries the
  drawing-office hatch, so a closed claim is unmistakable before a word is read.

  Below the head the page splits: the claim itself on the left (record, justification,
  receipts filed as evidence, what crediting it does to the pool) and, on the right, where
  the claim sits on the route and every hand that has touched it.
*/
export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // TODO: replace with API call
  const { requests, payouts, employeeById, updateRequestStatus } = useApp();
  const [lightbox, setLightbox] = useState<ReceiptFile | null>(null);
  const [exporting, setExporting] = useState(false);

  const request = useMemo(() => requests.find((r) => r.id === id), [requests, id]);
  const employee = request ? employeeById(request.employeeId) : undefined;
  const payout = useMemo(
    () => payouts.find((p) => p.requestId === id),
    [payouts, id],
  );

  if (!request) {
    return (
      <EmptyState
        icon={AlertTriangle}
        eyebrow="Not in the ledger"
        title="No claim is filed under that docket"
        description={`Nothing matches "${id ?? ''}". The docket may have been withdrawn, or the number mistyped.`}
        action={
          <Button variant="primary" onClick={() => navigate('/overview')}>
            Back to the overview
          </Button>
        }
      />
    );
  }

  const meta = statusMeta(request.status);
  const owner = actionOwner(request.status);
  // Refused by HR or by Accounts: the record stays legible, but it is struck out.
  const isVoid = request.status === 'HR_REJECTED' || request.status === 'ACC_REJECTED';
  const remaining = employee
    ? Math.max(0, employee.monthlyAllowance - employee.usedThisMonth - employee.pendingAmount)
    : 0;
  const after = remaining + request.amount;
  const receiptKb = request.receipts.reduce((sum, r) => sum + r.sizeKb, 0);

  const act = (status: RequestStatus, asRole: Role) =>
    updateRequestStatus(
      request.id,
      status,
      asRole === 'EMPLOYEE' ? (employee?.name ?? 'Employee') : ACTORS[asRole],
      asRole,
    );

  // The action tray shows the buttons belonging to whichever desk currently owns the step.
  const effectiveRole: Role | null = owner;

  const renderActions = () => {
    if (!owner || !effectiveRole) return null;

    const buttons: JSX.Element[] = [];
    if (effectiveRole === 'EMPLOYEE') {
      if (request.status === 'DRAFT') {
        buttons.push(
          <Button key="submit" variant="primary" onClick={() => act('SUBMITTED', 'EMPLOYEE')}>
            File this claim
          </Button>,
        );
      } else {
        buttons.push(
          <Button
            key="respond"
            variant="primary"
            onClick={() =>
              act(request.status === 'HR_INFO_REQUESTED' ? 'SUBMITTED' : 'HR_APPROVED', 'EMPLOYEE')
            }
          >
            Answer the query
          </Button>,
          <Button key="withdraw" variant="outline" onClick={() => act('HR_REJECTED', 'EMPLOYEE')}>
            Withdraw claim
          </Button>,
        );
      }
    } else if (effectiveRole === 'HR') {
      buttons.push(
        <Button key="a" variant="success" onClick={() => act('HR_APPROVED', 'HR')}>
          Clear for Accounts
        </Button>,
        <Button key="i" variant="outline" onClick={() => act('HR_INFO_REQUESTED', 'HR')}>
          Raise a query
        </Button>,
        <Button key="r" variant="danger" onClick={() => act('HR_REJECTED', 'HR')}>
          Reject claim
        </Button>,
      );
    } else if (effectiveRole === 'ACCOUNTS') {
      buttons.push(
        <Button key="a" variant="success" onClick={() => act('ACC_APPROVED', 'ACCOUNTS')}>
          Pass for payment
        </Button>,
        <Button key="b" variant="outline" onClick={() => act('HR_APPROVED', 'ACCOUNTS')}>
          Send back to HR
        </Button>,
        <Button key="r" variant="danger" onClick={() => act('ACC_REJECTED', 'ACCOUNTS')}>
          Reject claim
        </Button>,
      );
    } else if (effectiveRole === 'PAYMENTS') {
      buttons.push(
        <Button key="q" variant="primary" onClick={() => act('PAYMENT_QUEUED', 'PAYMENTS')}>
          Add to the next batch
        </Button>,
        <Button key="p" variant="outline" onClick={() => act('PAID', 'PAYMENTS')}>
          Mark disbursed
        </Button>,
        <Button key="c" variant="success" onClick={() => act('CREDITED', 'PAYMENTS')}>
          Confirm credited
        </Button>,
      );
    }

    return <div className="flex flex-wrap items-center gap-2">{buttons}</div>;
  };

  /* The four facts that head every docket, ruled into a strip under the amount. */
  const headFacts: Array<[string, ReactNode]> = [
    ['Category', CATEGORY_LABEL[request.category]],
    ['Filed on', <span className="ku-fig">{formatDate(request.submittedOn)}</span>],
    ['Travel dates', <span className="ku-fig">{formatDateRange(request.travelDates)}</span>],
    [
      'Receipts on file',
      <span className="ku-fig">
        {request.receipts.length} · {formatFileSize(receiptKb)}
      </span>,
    ],
  ];

  const details: Array<[string, ReactNode]> = [
    ['Category', <Badge>{CATEGORY_LABEL[request.category]}</Badge>],
    [
      'Amount claimed',
      <span className="ku-fig font-semibold">{formatCurrency(request.amount)}</span>,
    ],
    ['Filed', <span className="ku-fig">{formatDateTime(request.submittedOn)}</span>],
    ['Travel dates', <span className="ku-fig">{formatDateRange(request.travelDates)}</span>],
    ['Sitting with', <StagePill stage={request.currentStage} />],
    ['Review SLA', request.slaDueOn ? <SlaChip dueOn={request.slaDueOn} /> : '—'],
    ['Department', employee?.department ?? '—'],
    ['Reporting manager', employee?.managerName ?? '—'],
  ];

  if (request.duplicateOf) {
    details.push([
      'Flagged against',
      // Navy ink carries the text; the orange rule under it carries the link. Orange as
      // the letter colour cannot clear 4.5:1 on white, and this is a 12px docket number.
      <Link
        to={`/requests/${request.duplicateOf}`}
        className="ku-docket text-rich-black underline decoration-orangy decoration-2 underline-offset-2 transition-colors duration-150 hover:decoration-rich-black"
      >
        {request.duplicateOf}
      </Link>,
    ]);
  }

  const employeeRecord: Array<[string, ReactNode]> = employee
    ? [
        [
          'Employee code',
          <span className="ku-docket text-rich-black">{employee.employeeCode}</span>,
        ],
        ['Designation', employee.designation],
        ['Department', employee.department],
        ['Reports to', employee.managerName],
        ['Email', <span className="break-all">{employee.email}</span>],
      ]
    : [];

  const payoutRecord: Array<[string, ReactNode]> =
    payout && employee
      ? [
          ['Payout', <span className="ku-docket text-rich-black">{payout.id}</span>],
          [
            'Method',
            <span className="ku-fig text-caption uppercase tracking-stamp">{payout.method}</span>,
          ],
          ['Amount', <span className="ku-fig font-semibold">{formatCurrency(payout.amount)}</span>],
          ['State', <PayoutBadge status={payout.status} />],
          ['Released on', <span className="ku-fig">{formatDate(payout.initiatedOn)}</span>],
          [
            'Settled on',
            payout.settledOn ? <span className="ku-fig">{formatDate(payout.settledOn)}</span> : '—',
          ],
          ['UTR', <span className="ku-fig">{payout.utr ?? 'Not issued yet'}</span>],
          ['Bank', employee.bankAccount.bankName],
          [
            'Account',
            <span className="ku-fig">{maskAccount(employee.bankAccount.accountNumberMasked)}</span>,
          ],
          ['IFSC', <span className="ku-fig">{employee.bankAccount.ifsc}</span>],
        ]
      : [];

  return (
    <div className="pb-4">
      <PageHeader
        title={request.title}
        subtitle={
          employee
            ? `Reimbursement claim raised by ${employee.name}, ${employee.designation}, ${employee.department}.`
            : 'Reimbursement claim. The employee record behind this docket is unavailable.'
        }
        breadcrumb={[
          { label: 'Home', to: '/overview' },
          { label: 'Claims', to: '/hr' },
          { label: request.id },
        ]}
        actions={
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button
              variant="outline"
              icon={Download}
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await exportRequestPdf(request, employee, payout);
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? 'Generating…' : 'Export PDF'}
            </Button>
          </>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* The artifact head — the docket itself                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="ku-sheet relative overflow-hidden">
        {isVoid && (
          <span
            aria-hidden="true"
            className="ku-hatch pointer-events-none absolute inset-0 text-washed opacity-[0.13]"
          />
        )}

        <div className="relative flex flex-col gap-7 p-5 sm:p-6 md:flex-row md:items-start md:justify-between md:gap-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="ku-eyebrow">Claim docket</span>
              <span className="ku-docket text-rich-black">{request.id}</span>
            </div>

            <p className="ku-eyebrow mt-5">Amount claimed</p>
            <p className="ku-total mt-1.5 text-figure leading-none sm:text-figure-lg">
              {formatCurrency(request.amount)}
            </p>

            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-body-s text-meta">
              <span>Claimed by</span>
              <span className="font-semibold text-rich-black">
                {employee?.name ?? 'an unlisted employee'}
              </span>
              {employee && <span className="ku-docket">{employee.employeeCode}</span>}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
            {/*
              The struck stamp is the loudest mark in the system, so it only lands on a
              docket that has actually been decided — refused, credited, or with the money
              already out of the door. A claim still in flight takes the ordinary stamp;
              stamping a draft would read as a verdict that nobody has passed yet.
            */}
            {isTerminal(request.status) || request.status === 'PAID' ? (
              <Stamp label={meta.label} tone={meta.tone} />
            ) : (
              <StatusBadge status={request.status} size="md" />
            )}
            <SlaChip dueOn={request.slaDueOn} />
            <StagePill stage={request.currentStage} />
          </div>
        </div>

        <dl className="relative grid grid-cols-2 gap-px border-t border-hairline bg-hairline sm:grid-cols-4">
          {headFacts.map(([label, value]) => (
            <div key={label} className="bg-white px-5 py-3.5">
              <dt className="ku-eyebrow">{label}</dt>
              <dd className="mt-1.5 truncate text-body-s font-medium text-rich-black">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* The sheet: claim on the left, route and trail on the right          */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* The page's one signature device: a die-cut corner on the claim sheet. */}
          <Card variant="sheet" className="ku-notch">
            <CardHeader title="Claim record" subtitle="As filed, and the desk it is sitting on." />
            <dl className="ku-ruled">
              {details.map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-2.5 sm:px-5"
                >
                  <dt className="ku-eyebrow shrink-0">{label}</dt>
                  <dd className="min-w-0 text-right text-body-s text-rich-black">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Justification" subtitle="In the employee's own words." />
            <CardBody>
              <p className="ku-rule-accent py-1 text-body leading-relaxed text-light-black">
                {request.justification}
              </p>
            </CardBody>
          </Card>

          {/* Receipts are evidence, so they are filed as ruled rows, not picture tiles. */}
          <Card>
            <CardHeader
              title="Receipts"
              subtitle="The bills this claim stands on."
              action={
                request.receipts.length > 0 ? (
                  <span className="ku-fig text-caption text-meta">
                    {request.receipts.length} {request.receipts.length === 1 ? 'file' : 'files'} ·{' '}
                    {formatFileSize(receiptKb)}
                  </span>
                ) : undefined
              }
            />
            {request.receipts.length > 0 ? (
              <ul className="ku-ruled">
                {request.receipts.map((receipt, i) => (
                  <li
                    key={receipt.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-5"
                  >
                    <span className="ku-fig w-6 shrink-0 text-micro text-meta">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-hairline-strong" />
                    <span
                      className="min-w-0 flex-1 truncate text-body-s font-semibold text-rich-black"
                      title={receipt.fileName}
                    >
                      {receipt.fileName}
                    </span>
                    <span className="ku-fig shrink-0 text-caption text-meta">
                      {formatFileSize(receipt.sizeKb)}
                    </span>
                    <span className="ku-fig hidden shrink-0 text-caption text-meta sm:inline">
                      {formatDate(receipt.uploadedOn)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`View ${receipt.fileName}`}
                      onClick={() => setLightbox(receipt)}
                    >
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={FileText}
                eyebrow="No evidence filed"
                title="No receipts are attached"
                description="Accounts cannot pass a claim for payment without the underlying bill. The employee can attach one from their own copy of this docket."
              />
            )}
          </Card>

          <Card variant="sheet">
            <CardHeader
              title="Allowance impact"
              subtitle={
                employee
                  ? `What crediting this claim does to ${employee.name}'s monthly pool.`
                  : 'The employee record behind this docket is unavailable.'
              }
            />
            {employee ? (
              <>
                <LedgerBand cols={2} className="border-0">
                  <StatCard
                    label="Unspent today"
                    value={formatCurrency(remaining)}
                    sublabel={`of ${formatCurrency(employee.monthlyAllowance)}`}
                    footer={
                      <ProgressBar
                        height={8}
                        total={employee.monthlyAllowance}
                        segments={[
                          {
                            value: employee.usedThisMonth,
                            className: 'bg-darkey-bluey',
                            label: 'Drawn',
                          },
                          {
                            value: employee.pendingAmount,
                            className: 'bg-orangy',
                            label: 'In flight',
                          },
                          { value: remaining, className: 'bg-hairline-strong', label: 'Unspent' },
                        ]}
                      />
                    }
                  />
                  <StatCard
                    label="Unspent once credited"
                    tone="success"
                    value={formatCurrency(after)}
                    sublabel={`${formatCurrency(request.amount)} restored`}
                    footer={
                      <ProgressBar
                        height={8}
                        total={employee.monthlyAllowance}
                        segments={[
                          {
                            value: employee.usedThisMonth,
                            className: 'bg-darkey-bluey',
                            label: 'Drawn',
                          },
                          {
                            value: after,
                            className: 'bg-st-green-ink',
                            label: 'Unspent after credit',
                          },
                        ]}
                      />
                    }
                  />
                </LedgerBand>

                <p className="border-t border-hairline px-4 py-3 text-body-s text-meta sm:px-5">
                  Crediting this claim returns{' '}
                  <span className="ku-fig font-semibold text-rich-black">
                    {formatCurrency(request.amount)}
                  </span>{' '}
                  to {employee.name}&rsquo;s pool for the month.
                </p>
              </>
            ) : (
              <EmptyState
                compact
                eyebrow="Record missing"
                title="No employee record for this docket"
                description="The allowance pool cannot be read until the employee master is restored."
              />
            )}
          </Card>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* The rail: where the claim is, and everyone who has touched it     */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Route" subtitle="Where this claim sits on the approval chain." />
            <CardBody>
              {/* Horizontal while the rail is full width; a stacked ladder once it narrows. */}
              <Stepper steps={buildRequestSteps(request.status)} className="lg:flex-col" />
            </CardBody>
            <p className="border-t border-hairline px-4 py-3 text-body-s text-meta sm:px-5">
              {meta.hint}
            </p>
          </Card>

          <Card>
            <CardHeader title="Audit trail" subtitle="Every hand this docket has passed through." />
            <CardBody>
              {request.timeline.length > 0 ? (
                <Timeline events={request.timeline} />
              ) : (
                <EmptyState
                  compact
                  eyebrow="Nothing recorded"
                  title="The trail opens when the claim is filed"
                  description="This docket is still a draft, so no desk has stamped it yet."
                />
              )}
            </CardBody>
          </Card>

          {employee && (
            <>
              <Card>
                <CardHeader title="Employee" />
                <div className="flex items-center gap-3 border-b border-hairline px-4 py-3.5 sm:px-5">
                  <Avatar name={employee.name} size="md" />
                  <p className="min-w-0 truncate text-body font-semibold text-rich-black">
                    {employee.name}
                  </p>
                </div>
                <dl className="ku-ruled">
                  {employeeRecord.map(([label, value]) => (
                    <div
                      key={label}
                      className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 px-4 py-2.5 sm:px-5"
                    >
                      <dt className="ku-eyebrow shrink-0">{label}</dt>
                      <dd className="min-w-0 text-right text-body-s text-rich-black">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              <AllowanceCard employee={employee} compact />
            </>
          )}

          <Card>
            <CardHeader title="Disbursement" subtitle="The payout raised against this claim." />
            {payout && employee ? (
              <>
                <dl className="ku-ruled">
                  {payoutRecord.map(([label, value]) => (
                    <div
                      key={label}
                      className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 px-4 py-2.5 sm:px-5"
                    >
                      <dt className="ku-eyebrow shrink-0">{label}</dt>
                      <dd className="min-w-0 text-right text-body-s text-rich-black">{value}</dd>
                    </div>
                  ))}
                </dl>

                {payout.status === 'FAILED' && (
                  <div className="flex items-start gap-2.5 border-l-3 border-t border-l-washed border-t-hairline px-4 py-3 sm:px-5">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-washed"
                    />
                    <p className="text-body-s text-st-red-ink">
                      Returned by the bank —{' '}
                      {payout.failureReason ??
                        'no reason was given. Re-check the beneficiary record before releasing again.'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                compact
                eyebrow="Not raised yet"
                title="No payout against this docket"
                description="A payout is raised the moment Accounts passes the claim for payment."
              />
            )}
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* The action tray — whichever desk owns the claim right now           */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={cx(
          'sticky bottom-0 z-20 mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3',
          'border-t-3 border-t-darkey-bluey bg-white px-5 py-4',
          '-mx-5 sm:-mx-7 sm:px-7 lg:-mx-10 lg:px-10 xl:-mx-14 xl:px-14',
        )}
      >
        <div className="min-w-0">
          <p className="ku-eyebrow">
            {owner ? `Next action — ${ROLE_LABEL[owner]}` : 'Docket closed'}
          </p>
          <p className="mt-1 flex items-start gap-2 text-body-s text-meta">
            {!owner && <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
            {meta.hint}
          </p>
        </div>
        {renderActions()}
      </div>

      <ReceiptLightbox receipt={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
