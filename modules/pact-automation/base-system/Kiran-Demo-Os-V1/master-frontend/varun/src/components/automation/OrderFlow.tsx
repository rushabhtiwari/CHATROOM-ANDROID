import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FileWarning,
  Mail,
  PauseCircle,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import { pipelineApi } from '../../modules/pipeline/api';
import { usePipelineView } from '../../modules/pipeline/usePipeline';
import type { PipelineStep } from '../../modules/pipeline/types';
import { TONE, sentenceCase, Tone } from '../../lib/tone';

/**
 * One purchase order's whole journey.
 *
 * It is a *ledger*, not a progress bar. All five stages are always listed, including the
 * ones that have not run, because "the proforma has not been sent" and "there is no
 * proforma stage" are very different things to somebody watching a demo — and a bar that
 * only draws completed steps implies the second.
 *
 * The gate is drawn as a gate. Everything above the rule happened without anybody agreeing
 * to anything; the band after it needed an admin, and the band after that needed Accounts.
 * The console has a button to *retry* the lower half after a PACT pause, and no button
 * anywhere that could skip a gate — the server refuses that, and the panel says so plainly
 * rather than hiding the control and leaving the refusal unexplained.
 */

const STAGE_LABEL: Record<string, string> = {
  receipt: 'Automatic receipt to the customer',
  internal_notification: 'Internal notification',
  acknowledgement: 'Acknowledgement to the customer',
  team_tasks: 'Tasks for Sales, Accounts, Manufacturing',
  pact_push: 'PACT Purchase Order draft',
  proforma: 'Demo proforma',
  dispatch_notice: 'Closing message to the customer',
  close_tasks: 'Team tasks closed',
};

// The three bands the panel draws, separated by the two gates.
const UNGATED = ['receipt', 'internal_notification'] as const;
const AFTER_ADMIN = ['acknowledgement', 'team_tasks'] as const;
const GATED = ['pact_push', 'proforma', 'dispatch_notice', 'close_tasks'] as const;

export const OrderFlow: React.FC<{ jobId: string }> = ({ jobId }) => {
  const { view, error, refresh } = usePipelineView(jobId);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => setNotice(null), [jobId]);

  const act = async (action: 'run' | 'approve') => {
    setBusy(true);
    setNotice(null);
    try {
      if (action === 'run') {
        const result = await pipelineApi.run(jobId);
        const last = result.steps[result.steps.length - 1];
        setNotice(
          result.ok
            ? 'One PACT draft saved, proforma and closing message sent, team tasks closed.'
            : (last?.detail ?? 'The run stopped.'),
        );
      } else {
        const result = await pipelineApi.approveAsAdmin(jobId);
        setNotice(
          result.autoReleased
            ? 'Approved. The customer has been acknowledged, the teams tasked, and the robot is filling the PACT draft now — watch the PACT window.'
            : `Approved. The customer has been acknowledged and the teams tasked — now ${result.status}.`,
        );
      }
      await refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return <Empty>{error}</Empty>;
  }
  if (!view) {
    return <Empty>Loading…</Empty>;
  }

  const byStage = new Map<string, PipelineStep>();
  view.steps.forEach((step) => byStage.set(step.step, step));

  // The two gates, read off the job's own status rather than from a separate record.
  const status = view.status;
  const adminApproved = ![
    'AWAITING_ADMIN_APPROVAL',
    'RECEIVED',
    'CLASSIFIED',
    'EXTRACTING',
    'VALIDATED',
    'NOT_AN_ORDER',
    'EXCEPTION',
    'DISCARDED',
  ].includes(status);
  const accountsApproved = ['PUSHED_TO_PACT', 'COMPLETED'].includes(status);
  const tasks = view.tasks ?? [];
  const pushed = view.pactPushes.find((p) => p.status === 'SUCCEEDED' && p.documentNo);
  const lastPush = view.pactPushes[view.pactPushes.length - 1];
  // With PACT_AUTO_RELEASE the admin's approval is the only click: the second gate is
  // passed through by itself, and the console says so rather than showing a queue
  // nobody has to work. The state machine underneath is unchanged.
  const autoRelease = Boolean(view.pactAutoRelease);
  const releasing =
    autoRelease && adminApproved && !accountsApproved && lastPush?.status === 'RUNNING';
  // Whenever the order is approved, not yet in PACT, and nothing is running, there must
  // be a button that sends it - a paused push, a failed push, and an approval whose
  // automatic release never started all end here, and none may be a dead end.
  const needsRetry = adminApproved && !accountsApproved && !releasing;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- Head ------------------------------------------------------- */}
      <div className="border-b border-hairline px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="ku-docket">{view.jobId}</p>
            <h3 className="mt-1.5 font-display text-h3 font-semibold text-ink">
              {view.poNumber || '(no PO number)'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`ku-stamp ${TONE[view.tone as Tone].stamp}`}>{sentenceCase(view.statusLabel)}</span>
            <button
              type="button"
              onClick={() => void refresh()}
              aria-label="Refresh"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline-strong bg-white px-3 text-body-s font-medium leading-none text-ink transition-colors duration-150 hover:bg-canvas"
            >
              <RefreshCw aria-hidden size={13} />
            </button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          <Row label="Customer" value={view.customer} />
          <Row label="From" value={view.fromAddress} mono />
          <Row
            label="Quantity"
            value={`${Number(view.proposal.quantityMetres || 0).toLocaleString('en-IN')} m`}
            mono
          />
          <Row
            label="Order value"
            value={`Rs ${Number(view.proposal.orderValue || 0).toLocaleString('en-IN')}`}
            mono
          />
          <Row label="Delivery" value={view.proposal.deliveryDate} mono />
          <Row label="PACT screen" value={view.kpacProfile} mono />
        </dl>
      </div>

      <div className="ku-scrollbar min-h-0 flex-1 overflow-y-auto">
        {/* The demo's hard stop, surfaced where somebody can act on it rather than at
            the moment the push fails. */}
        {!view.inPactMaster && (
          <div className="border-b border-hairline px-5 py-4">
            <p className="flex items-start gap-2 border border-st-red-line bg-st-red-bg px-3 py-2 text-body-s text-ink">
              <FileWarning aria-hidden size={15} className="mt-0.5 shrink-0" />
              <span>
                <strong>customer not in PACT master: {view.customer || '—'}</strong>
                <br />
                This order cannot reach PACT until that name exists in the master, spelled
                identically. Nothing will be guessed or matched approximately.
              </span>
            </p>
          </div>
        )}

        {/* ---- Above the gate -------------------------------------------- */}
        <section className="border-b border-hairline px-5 py-4">
          <p className="ku-eyebrow">Ungated — receipt only, nothing committed</p>
          <ol className="ku-ruled mt-3 border border-hairline">
            {UNGATED.map((stage) => (
              <StageRow key={stage} stage={stage} step={byStage.get(stage)} />
            ))}
          </ol>
        </section>

        {/* ---- Gate 1: the admin ------------------------------------------ */}
        <section className="border-b border-hairline px-5 py-4">
          <div className="border border-hairline-strong">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2">
              <p className="ku-eyebrow">Gate 1 — an admin approves the order</p>
              <span className={`ku-stamp ${TONE[(adminApproved ? 'green' : 'amber') as Tone].stamp}`}>
                {adminApproved ? 'APPROVED' : 'AWAITING ADMIN'}
              </span>
            </div>

            <div className="px-3 py-3">
              {!adminApproved ? (
                <p className="text-body-s text-meta">
                  The customer has their receipt and nothing else. No work starts inside the
                  company, and nothing reaches PACT, until somebody here approves this order.
                </p>
              ) : (
                <>
                  <ol className="ku-ruled border border-hairline">
                    {AFTER_ADMIN.map((stage) => (
                      <StageRow key={stage} stage={stage} step={byStage.get(stage)} />
                    ))}
                  </ol>
                  {tasks.length > 0 && (
                    <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
                      {tasks.map((task) => (
                        <Row key={task.id} label={task.team} value={task.status} mono />
                      ))}
                    </dl>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* ---- Gate 2: Accounts -------------------------------------------- */}
        <section className="border-b border-hairline px-5 py-4">
          <div className="border border-hairline-strong">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2">
              <p className="ku-eyebrow">
                {autoRelease
                  ? 'Into PACT — released by the admin approval'
                  : 'Gate 2 — Accounts release it into PACT'}
              </p>
              <span
                className={`ku-stamp ${
                  TONE[
                    (accountsApproved
                      ? 'green'
                      : adminApproved
                        ? 'amber'
                        : 'grey') as Tone
                  ].stamp
                }`}
              >
                {accountsApproved
                  ? 'RELEASED'
                  : !adminApproved
                    ? 'NOT REACHED'
                    : releasing
                      ? 'FILLING PACT'
                      : autoRelease
                        ? needsRetry
                          ? 'NEEDS RETRY'
                          : 'RELEASING'
                        : 'AWAITING ACCOUNTS'}
              </span>
            </div>

            <div className="px-3 py-3">
              <p className="text-body-s text-meta">
                {accountsApproved
                  ? autoRelease
                    ? 'Released the moment the admin approved. Everything below happened after that.'
                    : 'Accounts released this order. Everything below happened after that.'
                  : autoRelease
                    ? adminApproved
                      ? needsRetry
                        ? `The PACT step did not finish: ${lastPush?.detail ?? 'see below'}. Fix the cause and press Retry PACT.`
                        : 'The admin approval released this order; the robot is filling the PACT draft now.'
                      : 'The admin approval releases this order straight into PACT. There is no second queue.'
                    : 'Nothing below can run until Accounts release this order. There is no timer into it.'}
              </p>
            </div>
          </div>
        </section>

        {/* ---- Below the gate --------------------------------------------- */}
        <section className="border-b border-hairline px-5 py-4">
          <p className="ku-eyebrow">
            {autoRelease
              ? 'After the approval — PACT draft, proforma, closing message'
              : 'Gated — reachable only through the Accounts approval'}
          </p>
          <ol className="ku-ruled mt-3 border border-hairline">
            {GATED.map((stage) => (
              <StageRow
                key={stage}
                stage={stage}
                step={byStage.get(stage)}
                locked={!accountsApproved}
              />
            ))}
          </ol>

          {pushed && (
            <p className="mt-3 flex items-center gap-2 border border-st-green-line bg-st-green-bg px-3 py-2 text-body-s text-ink">
              <CheckCircle2 aria-hidden size={15} className="shrink-0" />
              <span>
                PACT document <span className="ku-fig font-semibold">{pushed.documentNo}</span> —
                saved with <strong>Save Draft</strong>, never posted. Attempt {pushed.attempt}.
              </span>
            </p>
          )}

          {lastPush?.status === 'PAUSED' && (
            <p className="mt-3 flex items-start gap-2 border border-st-amber-line bg-st-amber-bg px-3 py-2 text-body-s text-ink">
              <PauseCircle aria-hidden size={15} className="mt-0.5 shrink-0" />
              <span>
                <strong>KPAC paused.</strong> {lastPush.detail} Nothing was lost — open PACT,
                log in, and press Push to PACT again.
              </span>
            </p>
          )}

          {(lastPush?.priceNotes?.length ?? 0) > 0 && (
            <div className="mt-3 border border-hairline px-3 py-2">
              <p className="ku-eyebrow">What PACT actually priced this at</p>
              <ul className="mt-1.5 space-y-1 text-body-s text-meta">
                {lastPush!.priceNotes!.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ---- The proforma ------------------------------------------------ */}
        {view.proforma && (
          <section className="border-b border-hairline px-5 py-4">
            <p className="ku-eyebrow">Demonstration proforma</p>
            <div
              className="mt-3"
              // Rendered by the server, which refuses to return HTML that reads as a tax
              // invoice (`proforma.assert_not_a_tax_invoice`). No user-authored markup.
              dangerouslySetInnerHTML={{ __html: view.proforma.html }}
            />
          </section>
        )}

        {/* ---- Outbound ledger --------------------------------------------- */}
        {view.outbound.length > 0 && (
          <section className="border-b border-hairline px-5 py-4">
            <p className="ku-eyebrow">Messages sent for this order</p>
            <ul className="ku-ruled mt-3 border border-hairline">
              {view.outbound.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <Mail aria-hidden size={13} className="shrink-0 text-hairline-strong" />
                  <span className="ku-stamp border-st-grey-ink text-st-grey-ink">{row.kind}</span>
                  <span className="min-w-0 flex-1 basis-48 truncate text-body-s text-ink">
                    {row.subject}
                  </span>
                  <span className="ku-fig text-caption text-meta">{row.to}</span>
                  <span className={`ku-stamp ${row.sent ? TONE.green.stamp : TONE.grey.stamp}`}>
                    {row.sent ? 'sent' : 'recorded'}
                  </span>
                  {!row.sent && row.reason && (
                    <span className="w-full text-caption text-meta">{row.reason}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---- Lifecycle ----------------------------------------------------- */}
        <section className="px-5 py-4">
          <p className="ku-eyebrow">Lifecycle</p>
          <ol className="mt-3 border-l border-hairline pl-0">
            {view.timeline.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex flex-wrap gap-x-4 gap-y-1 py-2">
                <span className="ku-fig w-24 shrink-0 text-right text-caption text-meta">
                  {new Date(entry.at).toLocaleTimeString()}
                </span>
                <span
                  aria-hidden
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${
                    index === view.timeline.length - 1 ? 'bg-accent' : 'bg-structure'
                  }`}
                />
                <span className="min-w-0 flex-1 basis-40 text-body-s text-ink">
                  {entry.action}
                  {entry.note && <span className="text-meta"> — {entry.note}</span>}
                  <span className="ku-docket ml-2">{entry.actor}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* ---- Actions ------------------------------------------------------- */}
      <div className="border-t border-hairline px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {!adminApproved && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act('approve')}
              className="inline-flex h-9 items-center gap-1.5 border border-ink bg-ink px-3 text-body-s font-semibold leading-none text-white transition-colors duration-150 hover:bg-ink/90 disabled:opacity-40"
            >
              <CheckCircle2 aria-hidden size={13} />{' '}
              {autoRelease ? 'Approve and fill PACT' : 'Approve as admin'}
            </button>
          )}
          {(!autoRelease || needsRetry) && (
            <button
              type="button"
              disabled={busy || !adminApproved || releasing}
              title={
                adminApproved
                  ? 'Save one PACT draft with every line item, then close the order out'
                  : 'An admin has to approve this first. The server refuses the request without it.'
              }
              onClick={() => void act('run')}
              className="inline-flex h-9 items-center gap-1.5 border border-ink bg-ink px-3 text-body-s font-semibold leading-none text-white transition-colors duration-150 hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <CheckCircle2 aria-hidden size={13} />{' '}
              {autoRelease ? 'Retry PACT' : 'Release to PACT as Accounts'}
            </button>
          )}
          {!adminApproved && (
            <span className="ku-docket flex items-center gap-1.5">
              <AlertTriangle aria-hidden size={12} />
              this button cannot substitute for the admin's approval
            </span>
          )}
        </div>
        {notice && <p className="mt-3 text-body-s text-ink">{notice}</p>}
      </div>
    </div>
  );
};

const StageRow: React.FC<{ stage: string; step?: PipelineStep; locked?: boolean }> = ({
  stage,
  step,
  locked,
}) => {
  const icon = !step ? (
    <Clock aria-hidden size={14} className="shrink-0 text-hairline-strong" />
  ) : step.status === 'done' ? (
    <CheckCircle2 aria-hidden size={14} className="shrink-0 text-st-green-ink" />
  ) : step.status === 'paused' ? (
    <PauseCircle aria-hidden size={14} className="shrink-0 text-st-amber-ink" />
  ) : (
    <XCircle aria-hidden size={14} className="shrink-0 text-st-red-ink" />
  );

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2.5">
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0 flex-1 basis-44 text-body-s font-semibold text-ink">
        {STAGE_LABEL[stage] ?? stage}
      </span>
      <span className="min-w-0 flex-[2] basis-56 text-body-s text-meta">
        {step ? step.detail : locked ? 'not run — waiting on the customer' : 'not run yet'}
        {step?.skipped && <span className="ku-docket ml-2">idempotent</span>}
      </span>
      {step && (
        <span className="ku-fig shrink-0 text-caption text-meta">
          {new Date(step.at).toLocaleTimeString()}
        </span>
      )}
    </li>
  );
};

const Row: React.FC<{ label: string; value?: string | null; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="flex min-w-0 items-baseline gap-3">
    <dt className="ku-docket w-24 shrink-0">{label}</dt>
    <dd className={`min-w-0 flex-1 truncate text-body-s text-ink ${mono ? 'ku-fig' : ''}`}>
      {value || '—'}
    </dd>
  </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-1 items-center justify-center px-5 py-16">
    <p className="text-body-s text-meta">{children}</p>
  </div>
);

const fmt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};
