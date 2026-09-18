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
    <div className={`sticky bottom-0 z-40 w-full bg-ink text-white border-t border-line/20 shadow-popover px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-strand-amber/20 border border-strand-amber/40 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-strand-amber" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <span>{title}</span>
            {nextSignee && (
              <span className="text-xs text-muted font-normal flex items-center gap-1">
                <ArrowRight className="w-3 h-3 text-slate-400" />
                Next: <strong className="text-white font-medium">{nextSignee}</strong>
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 ml-auto">
        {onReject && (
          <button
            onClick={onReject}
            className="px-3 py-1.5 rounded text-xs font-medium text-red-200 bg-red-950/60 hover:bg-red-900/80 border border-red-800 transition-colors flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        )}
        {onRequestChanges && (
          <button
            onClick={onRequestChanges}
            className="px-3 py-1.5 rounded text-xs font-medium text-slate-200 bg-ink-2 hover:bg-slate-700 border border-line/20 transition-colors flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 text-strand-amber" />
            Request changes
          </button>
        )}
        <button
          onClick={onApprove}
          className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-strand-green hover:bg-emerald-600 shadow-sm transition-colors flex items-center gap-1.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Approve
        </button>
      </div>
    </div>
  );
};
