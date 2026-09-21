import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface ApprovalBarProps {
  title: string;
  description?: string;
  nextSignee?: string;
  onApprove: () => void;
  onRequestChanges?: () => void;
  onReject?: () => void;
  className?: string;
}

export const ApprovalBar: React.FC<ApprovalBarProps> = ({
  title,
  description,
  nextSignee = 'K. S. Rao (Managing Director)',
  onApprove,
  onRequestChanges,
  onReject,
  className = ''
}) => {
  return (
    <div
      role="region"
      aria-label="Approval actions"
      className={`sticky bottom-0 z-40 flex w-full flex-wrap items-start justify-between gap-4 border-t-3 border-t-accent bg-structure px-6 py-3.5 text-white sm:items-center ${className}`}
    >
      <div className="flex items-center gap-3">
        <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-body font-semibold text-white">{title}</span>
            {nextSignee && (
              <span className="flex items-center gap-1 text-body-s text-hairline-strong">
                <ArrowRight aria-hidden className="h-3 w-3" />
                Next: <strong className="font-medium text-white">{nextSignee}</strong>
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 max-w-2xl text-body-s text-hairline-strong">{description}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 ml-auto">
        {onReject && (
          <button
        type="button"
        aria-label="Reject request"
            onClick={onReject}
            title="Reject request"
            className="inline-flex h-10 items-center gap-2 border border-st-red-line bg-transparent px-4 text-body-s font-semibold leading-none text-st-red-line transition-colors duration-150 hover:border-white hover:text-white"
          >
            <XCircle aria-hidden className="h-4 w-4" />
            Reject
          </button>
        )}
        {onRequestChanges && (
          <button
            type="button"
            aria-label="Request changes"
            onClick={onRequestChanges}
            title="Request changes"
            className="inline-flex h-10 items-center gap-2 border border-hairline-strong bg-transparent px-4 text-body-s font-semibold leading-none text-white transition-colors duration-150 hover:border-white"
          >
            <AlertCircle aria-hidden className="h-4 w-4" />
            Request changes
          </button>
        )}
        <button
          type="button"
          aria-label="Approve request"
          onClick={onApprove}
          title="Approve request"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-transparent bg-accent px-5 text-body-s font-semibold leading-none text-white transition-colors duration-150 hover:bg-accent-hover"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          Approve
        </button>
      </div>
    </div>
  );
};
