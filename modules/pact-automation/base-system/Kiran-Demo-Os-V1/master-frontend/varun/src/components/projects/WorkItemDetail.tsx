/**
 * A work item's detail body.
 *
 * Rendered by both the peek panel and the full-page route, so the two can never
 * drift apart — the panel is this component in a slide-over, and the page is
 * this component in a column.
 *
 * Left: title, description, sub-items, comments, activity. Right rail: every
 * property as a label/value row with an inline picker.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { displayId, isOverdue, subItemsOf } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import type { WorkItem } from '@/modules/projects/types';
import {
  AssigneePicker,
  CyclePicker,
  DatePicker,
  EstimatePicker,
  LabelPicker,
  ModulePicker,
  ParentPicker,
  PriorityPicker,
  StatePicker,
} from './PropertyPickers';
import { ActivityFeed, CommentThread, TimeLog } from './WorkItemActivity';
import { Markdown } from './Markdown';
import { PriorityIcon, StateIcon } from './Glyphs';

/** One label/value row in the right rail. */
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-outline-variant text-xs">
    <span className="w-20 shrink-0 text-[12px] font-medium text-outline">{label}</span>
    <div className="min-w-0 flex-1 flex justify-end">{children}</div>
  </div>
);

export const WorkItemDetail: React.FC<{ item: WorkItem; onClose?: () => void }> = ({
  item,
  onClose,
}) => {
  const { state, updateWorkItem, createWorkItem, deleteWorkItem } = useProjects();

  const patch = (changes: Parameters<typeof updateWorkItem>[1]) =>
    updateWorkItem(item.id, changes);

  /* ---------------- title ---------------- */

  const [title, setTitle] = useState(item.title);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Grow the title box to fit its content.
   *
   * A `rows={1}` textarea clips anything past the first line, and most of these
   * titles run to two — so this has to run on mount and on every change, not
   * only while typing.
   */
  const fitTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  // Re-sync when the panel is pointed at a different item without unmounting.
  useEffect(() => {
    setTitle(item.title);
  }, [item.id, item.title]);

  useEffect(fitTitle, [title]);

  const commitTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(item.title); // An empty title is not a title.
      return;
    }
    if (trimmed !== item.title) patch({ title: trimmed });
  };

  /* ---------------- description ---------------- */

  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(item.description);

  useEffect(() => {
    setDescription(item.description);
    setEditingDescription(false);
  }, [item.id, item.description]);

  /* ---------------- sub-items ---------------- */

  const [newSubItem, setNewSubItem] = useState('');
  const children = subItemsOf(state, item.id);
  const canHaveChildren = item.parentId === null;

  const addSubItem = () => {
    const trimmed = newSubItem.trim();
    if (!trimmed) return;
    createWorkItem({ projectId: item.projectId, title: trimmed, parentId: item.id });
    setNewSubItem('');
  };

  const project = state.projects.byId[item.projectId];
  const itemState = state.states.byId[item.stateId];

  return (
    <div className="flex h-full min-h-0">
      {/* ---------------- left column ---------------- */}
      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-mono text-[12px] text-muted">{displayId(state, item)}</span>
          {item.parentId && state.workItems.byId[item.parentId] && (
            <span className="truncate text-[12px] text-muted">
              · sub-item of{' '}
              <Link
                to={`/projects/${item.projectId}/items/${item.parentId}`}
                className="text-kiran hover:underline"
              >
                {state.workItems.byId[item.parentId].title}
              </Link>
            </span>
          )}
        </div>

        {/* Title — a textarea so long titles wrap rather than scroll sideways */}
        <textarea
          ref={titleRef}
          value={title}
          rows={1}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              titleRef.current?.blur();
            }
            if (event.key === 'Escape') {
              setTitle(item.title);
              titleRef.current?.blur();
            }
          }}
          className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 font-display text-[18px] font-semibold leading-snug text-ink hover:border-line focus:border-kiran/40 focus:bg-white focus:outline-none"
        />

        {/* Description */}
        <div className="mt-3">
          {editingDescription ? (
            <div>
              <textarea
                autoFocus
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                className="w-full resize-y rounded-md border border-line bg-white px-2.5 py-2 text-[12.5px] text-ink focus:border-kiran/40 focus:outline-none"
              />
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    patch({ description });
                    setEditingDescription(false);
                  }}
                  className="rounded-md bg-kiran px-3 py-1 text-[12px] font-semibold text-white hover:bg-brand-600"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDescription(item.description);
                    setEditingDescription(false);
                  }}
                  className="rounded-md border border-line px-3 py-1 text-[12px] font-medium text-slate-600 hover:bg-canvas"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingDescription(true)}
              className="block w-full rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-line hover:bg-canvas"
            >
              {item.description ? (
                <Markdown content={item.description} />
              ) : (
                <span className="text-[12.5px] text-muted">Add a description…</span>
              )}
            </button>
          )}
        </div>

        {/* Sub-items */}
        {canHaveChildren && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[12px] font-semibold text-outline font-mono">
                  Sub-items
                </h3>
                {children.length > 0 && (
                  <span className="font-mono text-[12px] text-outline bg-surface-container px-1.5 py-0.2 rounded border border-outline-variant">
                    {children.filter((c) => state.states.byId[c.stateId]?.group === 'completed').length}/{children.length}
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-container-lowest overflow-hidden">
              {children.map((child) => {
                const childState = state.states.byId[child.stateId];
                const done = childState?.group === 'completed';
                return (
                  <div key={child.id} className="flex h-9 items-center justify-between gap-2 px-3 hover:bg-surface-container-low/60 transition-colors">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <StateIcon
                        group={childState?.group ?? 'backlog'}
                        color={childState?.color}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span className="shrink-0 font-mono text-[12px] text-outline">
                        {displayId(state, child)}
                      </span>
                      <Link
                        to={`/projects/${child.projectId}/items/${child.id}`}
                        className={`min-w-0 truncate text-xs transition-colors hover:text-primary ${
                          done ? 'line-through text-outline' : 'text-on-surface'
                        }`}
                      >
                        {child.title}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        deleteWorkItem(child.id);
                        toast.success('Sub-item deleted');
                      }}
                      aria-label={`Delete ${child.title}`}
                      className="rounded p-1 text-outline transition-colors hover:bg-red-50 hover:text-strand-red"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}

              <div className="flex h-9 items-center gap-2 px-3 bg-surface-container-lowest">
                <Plus className="h-3.5 w-3.5 shrink-0 text-outline" />
                <input
                  value={newSubItem}
                  onChange={(event) => setNewSubItem(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addSubItem();
                  }}
                  placeholder="Add a sub-item... (Enter to add)"
                  className="w-full bg-transparent text-xs text-on-surface placeholder:text-outline focus:outline-none"
                />
              </div>
            </div>
          </section>
        )}

        <div className="mt-6 space-y-6 border-t border-outline-variant pt-5">
          <TimeLog workItemId={item.id} />
          <CommentThread workItemId={item.id} />
          <ActivityFeed workItemId={item.id} />
        </div>
      </div>

      {/* ---------------- right rail ---------------- */}
      <aside className="w-64 shrink-0 overflow-y-auto border-l border-outline-variant bg-surface-container-low/40 p-4 text-xs select-none">
        <h3 className="mb-2 text-[12px] font-semibold text-outline font-mono">
          Attributes
        </h3>

        <div className="flex flex-col">
          <Field label="State">
            <StatePicker
              projectId={item.projectId}
              value={item.stateId}
              onChange={(stateId) => patch({ stateId })}
            />
          </Field>

          <Field label="Priority">
            <PriorityPicker value={item.priority} onChange={(priority) => patch({ priority })} />
          </Field>

          <Field label="Assignees">
            <AssigneePicker
              projectId={item.projectId}
              value={item.assigneeIds}
              onChange={(assigneeIds) => patch({ assigneeIds })}
            />
          </Field>

          <Field label="Labels">
            <LabelPicker
              projectId={item.projectId}
              value={item.labelIds}
              onChange={(labelIds) => patch({ labelIds })}
            />
          </Field>

          <Field label="Start date">
            <DatePicker
              value={item.startDate}
              onChange={(startDate) => patch({ startDate })}
              placeholder="No start date"
            />
          </Field>

          <Field label="Due date">
            <DatePicker
              value={item.dueDate}
              onChange={(dueDate) => patch({ dueDate })}
              placeholder="No due date"
              overdue={isOverdue(state, item)}
            />
          </Field>

          <Field label="Estimate">
            <EstimatePicker value={item.estimate} onChange={(estimate) => patch({ estimate })} />
          </Field>

          <Field label="Cycle">
            <CyclePicker
              projectId={item.projectId}
              value={item.cycleId}
              onChange={(cycleId) => patch({ cycleId })}
            />
          </Field>

          <Field label="Module">
            <ModulePicker
              projectId={item.projectId}
              value={item.moduleId}
              onChange={(moduleId) => patch({ moduleId })}
            />
          </Field>

          <Field label="Parent">
            <ParentPicker
              projectId={item.projectId}
              itemId={item.id}
              value={item.parentId}
              onChange={(parentId) => patch({ parentId })}
            />
          </Field>
        </div>

        <div className="mt-4 pt-3 border-t border-outline-variant flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              deleteWorkItem(item.id);
              toast.success('Work item deleted', {
                description: children.length
                  ? `${children.length} sub-item${children.length > 1 ? 's' : ''} deleted with it.`
                  : undefined,
              });
              onClose?.();
            }}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-outline transition-colors hover:bg-red-50 hover:text-strand-red cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete work item
          </button>
        </div>
      </aside>
    </div>
  );
};
