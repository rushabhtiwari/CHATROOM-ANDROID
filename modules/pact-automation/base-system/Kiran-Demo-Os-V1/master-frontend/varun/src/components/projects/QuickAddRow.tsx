/**
 * The "+ New Issue" row under every group, column and table.
 *
 * Clicking it turns the row into a title field. Enter creates the issue into
 * that group and keeps the field open for the next one — a backlog gets
 * entered ten items at a sitting, not one. Escape, or leaving an empty field,
 * closes it again.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

export const QuickAddRow: React.FC<{
  onCreate: (title: string) => void;
  height?: number;
  /** Extra classes for the resting state, so a board column can pad it. */
  className?: string;
  label?: string;
}> = ({ onCreate, height = 36, className = '', label = 'New Issue' }) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    onCreate(trimmed);
    setTitle('');
  };

  if (editing) {
    return (
      <div
        style={{ height }}
        className={`flex items-center gap-2 border-b border-outline-variant bg-surface-container-low/80 pl-4 pr-3 ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        <Plus className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
        <input
          ref={inputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') {
              setTitle('');
              setEditing(false);
            }
          }}
          onBlur={() => {
            if (!title.trim()) setEditing(false);
          }}
          placeholder="Issue title — Enter to create, Esc to cancel"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-on-surface placeholder:text-outline focus:outline-none"
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={submit}
          disabled={!title.trim()}
          className="rounded bg-primary px-2 py-0.5 text-[12px] font-semibold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      style={{ height }}
      onClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
      className={`flex w-full items-center gap-2 border-b border-outline-variant pl-4 pr-3 text-left text-xs text-outline transition-colors hover:bg-surface-container-low hover:text-primary ${className}`}
    >
      <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
      {label}
    </button>
  );
};
