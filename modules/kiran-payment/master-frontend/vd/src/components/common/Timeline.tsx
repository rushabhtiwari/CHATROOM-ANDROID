import React from 'react';
import { TimelineEvent } from '../../types';
import { Sparkles, User, Clock } from 'lucide-react';
import { ConfidenceChip } from './ConfidenceChip';
import { formatDateTimeIST } from '../../utils/formatters';

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ events, className = '' }) => {
  if (!events || events.length === 0) {
    return (
      <div className="py-6 text-center text-muted text-xs">
        No recorded activity on this record yet.
      </div>
    );
  }

  return (
    <div className={`relative pl-4 border-l-2 border-line space-y-6 ${className}`}>
      {events.map((ev) => {
        const isAI = ev.actorType === 'ai';

        return (
          <div key={ev.id} className="relative group">
            {/* Dot / Glyph on vertical line */}
            <div
              className={`absolute -left-[23px] top-0.5 w-6 h-6 rounded-full border flex items-center justify-center text-xs shadow-xs ${
                isAI
                  ? 'bg-ai-tint border-ai/40 text-ai'
                  : 'bg-white border-line text-ink font-semibold'
              }`}
            >
              {isAI ? (
                <Sparkles className="w-3 h-3 text-ai" />
              ) : ev.avatar ? (
                <span className="font-mono text-[10px]">{ev.avatar}</span>
              ) : (
                <User className="w-3 h-3 text-slate" />
              )}
            </div>

            {/* Content Card */}
            <div className="bg-white border border-line rounded-md p-3 shadow-xs space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-ink">
                    {ev.actorName}
                  </span>
                  {isAI && ev.modelUsed && (
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-ai-tint text-ai border border-ai/20">
                      {ev.modelUsed}
                    </span>
                  )}
                  {ev.confidence !== undefined && (
                    <ConfidenceChip confidence={ev.confidence} />
                  )}
                </div>
                <span className="font-mono text-[10px] text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDateTimeIST(ev.timestamp)}
                </span>
              </div>

              <p className="text-xs font-medium text-slate-800">{ev.action}</p>

              {ev.detail && (
                <div className="mt-1 pt-1.5 border-t border-line/60 text-xs text-slate-600 font-mono bg-canvas/40 p-2 rounded">
                  {ev.detail}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
