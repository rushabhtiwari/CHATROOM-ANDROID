import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Clock, PauseCircle, XCircle } from 'lucide-react';
import { usePipelineView } from '../../modules/pipeline/usePipeline';
import { TONE, Tone } from '../../lib/tone';

/**
 * A strip in the message inspector saying where this order got to.
 *
 * Deliberately a summary and a link rather than a second copy of the flow. The full
 * journey — every step, the customer's answer, the PACT draft, the proforma and the
 * operator's controls — lives in Order Automation, and rendering it in two places would
 * guarantee the two drift. So this answers one question ("what happened to this?") and
 * points at the screen that answers the rest.
 */

const STAGES = [
  { key: 'receipt', label: 'Receipt' },
  { key: 'internal_notification', label: 'Sales' },
  { key: 'acknowledgement', label: 'Acknowledged' },
  { key: 'team_tasks', label: 'Tasked' },
  { key: 'pact_push', label: 'PACT' },
  { key: 'proforma', label: 'Proforma' },
  { key: 'dispatch_notice', label: 'Dispatch' },
] as const;

export const PipelinePanel: React.FC<{ jobId: string }> = ({ jobId }) => {
  const { view, error } = usePipelineView(jobId);

  if (error || !view) return null;

  const byStage = new Map(view.steps.map((step) => [step.step, step]));
  const pushed = view.pactPushes.find((p) => p.status === 'SUCCEEDED' && p.documentNo);
  const openTasks = (view.tasks ?? []).filter((t) => t.status === 'OPEN').length;

  return (
    <section className="border-b border-hairline px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="ku-eyebrow">Order progress</p>
        <Link
          to={`/admin/automation/orders/${jobId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline-strong bg-white px-3 text-body-s font-medium leading-none text-ink transition-colors duration-150 hover:bg-canvas"
        >
          Open order <ArrowUpRight aria-hidden size={13} />
        </Link>
      </div>

      {/* Always every stage: "the proforma has not been sent" and "there is no proforma
          stage" are different facts, and only listing what has run implies the second. */}
      <ol className="mt-3 flex flex-wrap gap-2">
        {STAGES.map((stage) => {
          const step = byStage.get(stage.key);
          const tone: Tone = !step
            ? 'grey'
            : step.status === 'done'
              ? 'green'
              : step.status === 'paused'
                ? 'amber'
                : 'red';
          const Icon = !step
            ? Clock
            : step.status === 'done'
              ? CheckCircle2
              : step.status === 'paused'
                ? PauseCircle
                : XCircle;
          return (
            <li key={stage.key} className={`ku-stamp ${TONE[tone].stamp}`} title={step?.detail}>
              <Icon aria-hidden size={11} />
              {stage.label}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-body-s text-meta">
        {view.status === 'AWAITING_ADMIN_APPROVAL' && (
          <>
            Waiting for admin approval.
          </>
        )}
        {view.status === 'AWAITING_ACCOUNTS_APPROVAL' && (
          <>
            Waiting for Accounts. {openTasks} task(s) open.
          </>
        )}
        {pushed && (
          <>
            PACT draft{' '}
            <span className="font-code text-[12.5px] text-ink">{pushed.documentNo}</span> saved.
          </>
        )}
        {view.status === 'DISCARDED' && <>Closed.</>}
      </p>
    </section>
  );
};
