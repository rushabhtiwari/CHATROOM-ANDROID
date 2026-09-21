import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  statement: string;
  /** Accepted for compatibility; an empty state is one short sentence. */
  instruction?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  statement,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div
      className={`px-6 py-12 flex flex-col items-center justify-center text-center ${className}`}
    >
      <Icon className="w-6 h-6 text-slate-500" />
      <p className="mt-3 text-[14px] text-muted max-w-md">{statement}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-secondary mt-4">
          {actionLabel}
        </button>
      )}
    </div>
  );
};
