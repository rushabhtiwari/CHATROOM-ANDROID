import { Check, X } from 'lucide-react';
import type { RequestStatus } from '@/lib/types';
import { ROLE_LABEL, STATUS_RANK, actionOwner, statusLabel } from '@/lib/status';
import { cx } from '@/lib/format';

export type StepState = 'complete' | 'current' | 'pending' | 'rejected';

export interface Step {
  key: string;
  label: string;
  state: StepState;
  caption?: string;
  /** A date, amount or count belonging to this stage — set in the mono figure face. */
  figure?: string;
}

/**
 * The approval pipeline is a routing slip, not a row of numbered bubbles: one continuous
 * rule divided into labelled segments. The rule carries the state — navy behind a cleared
 * stage, orange under the stage the claim is sitting on, hairline for everything still to
 * come — so the whole route reads at a glance from the rule alone.
 */
const RULE_CLASSES: Record<StepState, string> = {
  complete: 'bg-darkey-bluey',
  current: 'bg-orangy',
  pending: 'bg-hairline',
  rejected: 'bg-washed',
};

const LABEL_CLASSES: Record<StepState, string> = {
  complete: 'text-rich-black',
  current: 'text-rich-black',
  pending: 'text-meta',
  rejected: 'text-st-red-ink',
};

const CAPTION_CLASSES: Record<StepState, string> = {
  complete: 'text-meta',
  current: 'font-semibold text-rich-black',
  pending: 'text-meta',
  rejected: 'font-semibold text-st-red-ink',
};

export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cx('flex flex-col md:flex-row', className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const thin = step.state === 'pending';

        return (
          <li
            key={step.key}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className={cx(
              'relative flex-1 pl-4 md:pl-0',
              isLast ? 'pb-0' : 'pb-4 md:pb-0',
            )}
          >
            {/*
              The segment rule. Vertical on mobile so the route runs down the page,
              horizontal from md up so the stages butt together into one ruled line.
            */}
            <span
              aria-hidden="true"
              className={cx(
                'absolute left-0 top-0 h-full',
                thin ? 'w-px md:h-px md:w-full' : 'w-[3px] md:h-[3px] md:w-full',
                RULE_CLASSES[step.state],
              )}
            />

            <div className="md:pr-5 md:pt-3">
              <div className="flex items-center gap-2">
                <span className="ku-fig text-micro text-meta">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {step.state === 'complete' ? (
                  <Check size={13} aria-hidden="true" className="shrink-0 text-darkey-bluey" />
                ) : step.state === 'rejected' ? (
                  <X size={13} aria-hidden="true" className="shrink-0 text-washed" />
                ) : step.state === 'current' ? (
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-orangy" />
                ) : null}
                <span className={cx('ku-eyebrow min-w-0 leading-4', LABEL_CLASSES[step.state])}>
                  {step.label}
                </span>
              </div>

              {step.caption ? (
                <p className={cx('mt-1.5 text-body-s leading-tight', CAPTION_CLASSES[step.state])}>
                  {step.caption}
                </p>
              ) : null}

              {step.figure ? (
                <p className="ku-fig mt-1 text-caption text-meta">{step.figure}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const STEP_DEFS: { key: string; label: string }[] = [
  { key: 'submitted', label: 'Filed' },
  { key: 'hr', label: 'HR review' },
  { key: 'accounts', label: 'Accounts review' },
  { key: 'payment', label: 'Disbursement' },
  { key: 'credited', label: 'Credited' },
];

/**
 * Derives the five-step pipeline state from a single status.
 * STATUS_RANK is the index of the step a request is sitting on; everything before it is
 * complete, everything after is pending, and a rejection paints that step red.
 */
export function buildRequestSteps(status: RequestStatus): Step[] {
  const rank = STATUS_RANK[status];
  const rejected = status === 'HR_REJECTED' || status === 'ACC_REJECTED';
  const allComplete = status === 'CREDITED';
  const owner = actionOwner(status);

  return STEP_DEFS.map((def, i) => {
    let state: StepState;
    if (allComplete || i < rank) state = 'complete';
    else if (i === rank) state = rejected ? 'rejected' : 'current';
    else state = 'pending';

    let caption: string;
    if (state === 'complete') caption = 'Cleared';
    else if (state === 'rejected') caption = statusLabel(status);
    else if (state === 'current') caption = owner ? `With ${ROLE_LABEL[owner]}` : statusLabel(status);
    else caption = 'Not started';

    return { key: def.key, label: def.label, state, caption };
  });
}
