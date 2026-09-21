import React, { useState } from 'react';
import { ConfidenceChip } from './ConfidenceChip';
import { Edit2, Check } from 'lucide-react';

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
      className={`relative group rounded-md px-2 py-1.5 transition-colors hover:bg-canvas ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="text-[13px] font-medium text-muted">{label}</span>
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
            className="field"
            autoFocus
          />
          <button
            onClick={handleSave}
            className="btn-icon shrink-0"
            title="Save correction"
            aria-label="Save correction"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className={`text-[14px] ${isMissing ? 'text-muted' : 'text-ink font-medium'}`}>
            {value || 'Not found'}
          </div>
          {isMissing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-[13px] text-kiran hover:underline shrink-0"
            >
              Add
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              aria-label="Edit"
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-ink transition-opacity"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Popover on hover */}
      {isHovered && isExtracted && !isEditing && (
        <div className="absolute left-0 bottom-full mb-1 z-50 w-72 p-3 bg-white text-ink rounded-lg shadow-popover border border-line text-[13px] space-y-1.5">
          <div className="truncate font-medium">{sourceEmailSubject}</div>
          {sourceText && (
            <div className="rounded-md bg-surface-2 px-2 py-1.5 text-[13px] text-slate-700">
              "{sourceText}"
            </div>
          )}
          <div className="text-[12px] text-muted">
            {confidence}% · {modelUsed} · {timestamp}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="text-[13px] font-medium text-kiran hover:underline"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
};
