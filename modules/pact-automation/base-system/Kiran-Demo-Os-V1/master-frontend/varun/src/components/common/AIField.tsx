import React, { useState } from 'react';
import { ConfidenceChip } from './ConfidenceChip';
import { Sparkles, Edit2, Check, ExternalLink } from 'lucide-react';

interface AIFieldProps {
  label: string;
  value: string | number | undefined | null;
  confidence?: number;
  sourceEmailSubject?: string;
  sourceText?: string;
  modelUsed?: string;
  timestamp?: string;
  isExtracted?: boolean;
  onHover?: (sourceText?: string) => void;
  onLeave?: () => void;
  onCorrect?: (newValue: string) => void;
  className?: string;
}

export const AIField: React.FC<AIFieldProps> = ({
  label,
  value,
  confidence = 95,
  sourceEmailSubject = 'Inbound Customer Email Inquiry',
  sourceText,
  modelUsed = 'claude-sonnet-4-6',
  timestamp = '19 Aug 2026, 06:14 AM IST',
  isExtracted = true,
  onHover,
  onLeave,
  onCorrect,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value || ''));

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (onHover) onHover(sourceText);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (onLeave) onLeave();
  };

  const handleSave = () => {
    setIsEditing(false);
    if (onCorrect) {
      onCorrect(editValue);
    }
  };

  const isMissing = !value || value === 'Not found in email';

  return (
    <div
      className={`relative group rounded-sm p-2 transition-all ${
        isExtracted ? 'border-l-2 border-ai bg-ai-tint/20' : 'border-l-2 border-transparent bg-canvas/60'
      } ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-semibold text-muted flex items-center gap-1">
          {isExtracted && <Sparkles className="w-3 h-3 text-ai" />}
          {label}
        </span>
        {isExtracted && !isMissing && (
          <ConfidenceChip confidence={confidence} />
        )}
      </div>

      {isEditing ? (
        <div className="flex items-center gap-1.5 mt-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full text-xs font-mono bg-white border border-ai rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ai text-ink"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSave}
            aria-label="Save correction"
            className="p-1 bg-ai text-white rounded hover:bg-ai/90"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div
            className={`text-xs font-medium ${
              isMissing
                ? 'text-muted italic'
                : 'text-ink font-mono'
            }`}
          >
            {value || 'Not found in email'}
          </div>
          {isMissing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label={`Ask customer for ${label}`}
              className="text-[12px] text-ai hover:underline flex items-center gap-0.5 ml-2 shrink-0"
            >
              Ask customer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label={`Edit ${label}`}
              className="text-[12px] text-muted hover:text-ai transition-colors flex items-center gap-0.5"
            >
              <Edit2 className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}

      {/* Popover on Hover */}
      {isHovered && isExtracted && !isEditing && (
        <div className="absolute left-0 bottom-full mb-1 z-50 w-72 p-2.5 bg-ink text-white rounded-md shadow-popover border border-line/20 text-[12px]">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
            <span className="font-semibold text-ai-tint flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-ai" />
              AI Extracted Field
            </span>
            <span className="font-mono text-[12px] text-slate-300">{modelUsed}</span>
          </div>

          <div className="space-y-1 text-slate-300">
            <div className="truncate">
              <span className="text-muted">Source: </span>
              <span className="text-white">{sourceEmailSubject}</span>
            </div>
            {sourceText && (
              <div className="bg-white/5 p-1 rounded font-mono text-[12px] text-ai-tint/90 border border-ai/30">
                "{sourceText}"
              </div>
            )}
            <div className="text-[12px] text-slate-400">
              Confidence: {confidence}% · {timestamp}
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label={`Correct ${label}`}
              className="text-ai-tint hover:text-white font-medium flex items-center gap-1 text-[12px]"
            >
              <Edit2 className="w-2.5 h-2.5" /> Correct this value
            </button>
            <span className="text-[12px] text-slate-400">Hover links to text</span>
          </div>
        </div>
      )}
    </div>
  );
};
