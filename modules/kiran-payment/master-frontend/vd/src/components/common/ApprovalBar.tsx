import React from 'react';

interface ApprovalBarProps {
  title: string;
  /** Accepted for compatibility; the bar shows the title and next signee only. */
  description?: string;
  nextSignee?: string;
  onApprove: () => void;
  onRequestChanges?: () => void;
  onReject?: () => void;
  className?: string;
}

export const ApprovalBar: React.FC<ApprovalBarProps> = ({
  title,
  nextSignee = 'K. S. Rao (Managing Director)',
  onApprove,
  onRequestChanges,
  onReject,
  className = ''
}) => {
  return (
    <div className={`sticky bottom-0 z-40 w-full bg-white border-t border-line px-6 py-3 flex flex-wrap items-center justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-ink truncate">{title}</div>
        {nextSignee && (
          <div className="text-[13px] text-muted truncate">Next: {nextSignee}</div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {onReject && (
          <button onClick={onReject} className="btn-secondary text-strand-red">
            Reject
          </button>
        )}
        {onRequestChanges && (
          <button onClick={onRequestChanges} className="btn-secondary">
            Request changes
          </button>
        )}
        <button onClick={onApprove} className="btn-primary">
          Approve
        </button>
      </div>
    </div>
  );
};
