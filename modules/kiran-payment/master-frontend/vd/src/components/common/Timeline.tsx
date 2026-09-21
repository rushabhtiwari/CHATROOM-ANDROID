import React from 'react';
import { TimelineEvent } from '../../types';
import { Sparkles, User } from 'lucide-react';
import { ConfidenceChip } from './ConfidenceChip';
import { formatDateTimeIST } from '../../utils/formatters';

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ events, className = '' }) => {
  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-muted text-[14px]">
        No activity yet.
      </div>
    );
  }

  return (
    <div className={`relative pl-5 border-l border-line space-y-5 ${className}`}>
      {events.map((ev) => {
        const isAI = ev.actorType === 'ai';

        return (
          <div key={ev.id} className="relative">
            {/* Glyph on the vertical line */}
            <div className="absolute -left-[33px] top-0 w-6 h-6 rounded-full border border-line bg-white flex items-center justify-center text-slate-500">
              {isAI ? (
                <Sparkles className="w-3 h-3" />
              ) : ev.avatar ? (
                <span className="text-[12px] font-medium text-ink">{ev.avatar}</span>
              ) : (
                <User className="w-3 h-3" />
              )}
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <p className="text-[14px] font-medium text-ink">{ev.action}</p>
              <span className="text-[13px] text-muted whitespace-nowrap">
                {formatDateTimeIST(ev.timestamp)}
              </span>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span>{ev.actorName}</span>
              {isAI && ev.modelUsed && <span title="Model">{ev.modelUsed}</span>}
              {ev.confidence !== undefined && (
                <ConfidenceChip confidence={ev.confidence} />
              )}
            </div>

            {ev.detail && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">{ev.detail}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
