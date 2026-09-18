/**
 * The create work item modal, bound to `C`.
 *
 * Title, markdown description, and every property inline along the bottom as
 * dropdown buttons — so an item can be created fully formed rather than created
 * empty and then edited five times.
 *
 * "Create more" keeps the modal open and clears it after each create, which is
 * how a backlog actually gets entered: ten items in one sitting, not one.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { statesForProject } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import type { NewWorkItemInput } from '@/modules/projects/store';
import type { Priority } from '@/modules/projects/types';
import {
  AssigneePicker,
  CyclePicker,
  DatePicker,
  EstimatePicker,
  LabelPicker,
  ModulePicker,
  PriorityPicker,
  StatePicker,
} from './PropertyPickers';

interface Draft {
  title: string;
  description: string;
  stateId: string;
  priority: Priority;
  assigneeIds: string[];
  labelIds: string[];
  startDate: string | null;
  dueDate: string | null;
  estimate: number | null;
  cycleId: string | null;
  moduleId: string | null;
}

export const CreateWorkItemModal: React.FC<{
  projectId: string;
  open: boolean;
  onClose: () => void;
  /** Pre-set properties — the board's per-column "+" creates into that column. */
  defaults?: Partial<Draft>;
  onCreated?: (itemId: string) => void;
}> = ({ projectId, open, onClose, defaults }) => {
  const { state, createWorkItem } = useProjects();
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const blank = useMemo<Draft>(() => {
    const states = statesForProject(state, projectId);
    const fallback =
      states.find((entry) => entry.group === 'unstarted') ??
      states.find((entry) => entry.group === 'backlog') ??
      states[0];

    return {
      title: '',
      description: '',
      stateId: fallback?.id ?? '',
      priority: 'none',
      assigneeIds: [],
      labelIds: [],
      startDate: null,
      dueDate: null,
      estimate: null,
      cycleId: null,
      moduleId: null,
      ...defaults,
    };
  }, [state, projectId, defaults]);

  const [draft, setDraft] = useState<Draft>(blank);
  const [createMore, setCreateMore] = useState(false);

  // Reset on open, not on close, so the modal never flashes empty on the way out.
  // Focus is `autoFocus` on the field rather than a timer here: a timer races
  // anyone who starts typing immediately after pressing C, and drops the first
  // characters of the title.
  useEffect(() => {
    if (open) setDraft(blank);
  }, [open, blank]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    const title = draft.title.trim();
    if (!title) return;

    const input: NewWorkItemInput = { ...draft, title, projectId };
    createWorkItem(input);
    toast.success('Work item created', { description: title });

    if (createMore) {
      setDraft({ ...blank, title: '', description: '' });
      titleRef.current?.focus();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/40 px-4 pt-[10vh] backdrop-blur-[2px] animate-overlay-in">
      <div
        role="dialog"
        aria-label="Create work item"
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-2xl flex-col rounded-xl border border-line bg-white shadow-modal animate-dialog-in"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span className="rounded border border-line bg-canvas px-1.5 font-mono text-[10.5px] font-bold text-kiran">
              {state.projects.byId[projectId]?.key}
            </span>
            New work item
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-canvas hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-4 py-3">
          <textarea
            ref={titleRef}
            autoFocus
            value={draft.title}
            rows={1}
            onChange={(event) => {
              set('title', event.target.value);
              const el = event.target;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
            onKeyDown={(event) => {
              // Enter submits from the title; the description is where newlines
              // belong.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Work item title"
            className="w-full resize-none bg-transparent font-display text-[17px] font-semibold text-ink placeholder:font-sans placeholder:font-normal placeholder:text-muted focus:outline-none"
          />

          <textarea
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
            rows={3}
            placeholder="Description… markdown is supported"
            className="mt-2 w-full resize-y bg-transparent text-[12.5px] text-slate-700 placeholder:text-muted focus:outline-none"
          />
        </div>

        {/* Properties, inline along the bottom */}
        <div className="flex flex-wrap items-center gap-1 border-t border-line-2 px-3 py-2">
          <StatePicker
            projectId={projectId}
            value={draft.stateId}
            onChange={(stateId) => set('stateId', stateId)}
          />
          <PriorityPicker value={draft.priority} onChange={(priority) => set('priority', priority)} />
          <AssigneePicker
            projectId={projectId}
            value={draft.assigneeIds}
            onChange={(ids) => set('assigneeIds', ids)}
            compact
          />
          <LabelPicker
            projectId={projectId}
            value={draft.labelIds}
            onChange={(ids) => set('labelIds', ids)}
          />
          <DatePicker
            value={draft.dueDate}
            onChange={(dueDate) => set('dueDate', dueDate)}
            placeholder="Due date"
          />
          <EstimatePicker value={draft.estimate} onChange={(estimate) => set('estimate', estimate)} />
          <CyclePicker
            projectId={projectId}
            value={draft.cycleId}
            onChange={(cycleId) => set('cycleId', cycleId)}
          />
          <ModulePicker
            projectId={projectId}
            value={draft.moduleId}
            onChange={(moduleId) => set('moduleId', moduleId)}
          />
        </div>

        <footer className="flex items-center justify-between rounded-b-xl border-t border-line bg-canvas px-4 py-2.5">
          <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] text-slate-600">
            <input
              type="checkbox"
              checked={createMore}
              onChange={(event) => setCreateMore(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-input text-kiran focus:ring-kiran"
            />
            Create more
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!draft.title.trim()}
              className="rounded-md bg-kiran px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Create work item
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
