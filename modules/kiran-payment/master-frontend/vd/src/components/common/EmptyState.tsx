import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  statement: string;
  instruction?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  statement,
  instruction,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div
      className={`p-10 border border-dashed border-line rounded-md bg-surface flex flex-col items-center justify-center text-center space-y-3 ${className}`}
    >
      <div className="w-10 h-10 rounded-md bg-canvas border border-line flex items-center justify-center text-muted">
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-0.5 max-w-md">
        <h4 className="text-sm font-semibold text-ink">{statement}</h4>
        {instruction && <p className="text-xs text-muted">{instruction}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
