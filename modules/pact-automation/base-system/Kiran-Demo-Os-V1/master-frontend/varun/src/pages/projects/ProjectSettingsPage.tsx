/**
 * `/projects/:id/settings` — states, labels, members, and the reset.
 *
 * States and labels are per-project data, so they are edited here rather than
 * being a code change. Deleting a state moves its items to a replacement you
 * pick, because a work item without a state cannot be rendered by any layout.
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LABEL_COLORS, STATE_GROUPS } from '@/modules/projects/constants';
import {
  labelsForProject,
  memberLoad,
  statesForProject,
  workItemsForProject,
} from '@/modules/projects/selectors';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import type { StateGroup } from '@/modules/projects/types';
import { Avatar, Dot, StateIcon } from '@/components/projects/Glyphs';
import { Dropdown, DropdownItem } from '@/components/projects/Dropdown';

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <section className="rounded-lg border border-line bg-white p-4 shadow-card">
    <h2 className="font-display text-[13.5px] font-semibold text-ink">{title}</h2>
    {hint && <p className="mt-0.5 text-[11.5px] text-muted">{hint}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

export const ProjectSettingsPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { state, dispatch, resetDemoData } = useProjects();

  const states = statesForProject(state, id);
  const labels = labelsForProject(state, id);
  const project = state.projects.byId[id];
  const items = workItemsForProject(state, id);
  const load = memberLoad(state, id);

  const [newState, setNewState] = useState('');
  const [newStateGroup, setNewStateGroup] = useState<StateGroup>('unstarted');
  const [newLabel, setNewLabel] = useState('');

  const addState = () => {
    const name = newState.trim();
    if (!name) return;
    dispatch({
      type: 'state/create',
      state: {
        projectId: id,
        name,
        group: newStateGroup,
        color: STATE_GROUPS.find((g) => g.id === newStateGroup)!.color,
        order: states.filter((s) => s.group === newStateGroup).length,
      },
    });
    setNewState('');
    toast.success(`State "${name}" added`);
  };

  const addLabel = () => {
    const name = newLabel.trim();
    if (!name) return;
    dispatch({
      type: 'label/create',
      label: {
        projectId: id,
        name,
        color: LABEL_COLORS[labels.length % LABEL_COLORS.length],
      },
    });
    setNewLabel('');
    toast.success(`Label "${name}" added`);
  };

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* ---------------- states ---------------- */}
        <Section
          title="States"
          hint="Each state belongs to one of five groups, which is what progress, the board order and the burndown are computed from."
        >
          <ul className="divide-y divide-line-2 rounded-md border border-line">
            {states.map((entry) => {
              const count = items.filter((item) => item.stateId === entry.id).length;
              const others = states.filter((s) => s.id !== entry.id);

              return (
                <li key={entry.id} className="flex items-center gap-2.5 px-3 py-2">
                  <StateIcon group={entry.group} color={entry.color} />
                  <input
                    value={entry.name}
                    onChange={(event) =>
                      dispatch({
                        type: 'state/patch',
                        id: entry.id,
                        patch: { name: event.target.value },
                      })
                    }
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] text-ink hover:border-line focus:border-kiran/40 focus:bg-white focus:outline-none"
                  />
                  <span className="shrink-0 rounded border border-line bg-canvas px-1.5 text-[10px] uppercase tracking-wide text-muted">
                    {entry.group}
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-[11px] text-muted">
                    {count}
                  </span>

                  {/* Deleting a state has to say where its items go. */}
                  {states.length > 1 && (
                    <Dropdown
                      align="right"
                      width="w-56"
                      trigger={() => (
                        <button
                          type="button"
                          aria-label={`Delete ${entry.name}`}
                          className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-strand-red"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <p className="px-2.5 py-1.5 text-[11.5px] text-muted">
                            {count > 0
                              ? `Move ${count} item${count === 1 ? '' : 's'} to…`
                              : 'Delete this state?'}
                          </p>
                          {others.map((other) => (
                            <DropdownItem
                              key={other.id}
                              icon={<StateIcon group={other.group} color={other.color} />}
                              onSelect={() => {
                                dispatch({
                                  type: 'state/delete',
                                  id: entry.id,
                                  reassignTo: other.id,
                                });
                                toast.success(`"${entry.name}" deleted`, {
                                  description:
                                    count > 0
                                      ? `${count} item${count === 1 ? '' : 's'} moved to ${other.name}.`
                                      : undefined,
                                });
                                close();
                              }}
                            >
                              {other.name}
                            </DropdownItem>
                          ))}
                        </>
                      )}
                    </Dropdown>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex items-center gap-2">
            <input
              value={newState}
              onChange={(event) => setNewState(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addState()}
              placeholder="New state name"
              className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-[12.5px] focus:border-kiran/40 focus:outline-none"
            />
            <Dropdown
              width="w-44"
              trigger={() => (
                <button
                  type="button"
                  className="rounded-md border border-line px-2 py-1.5 text-[12px] text-slate-600 hover:bg-canvas"
                >
                  {STATE_GROUPS.find((g) => g.id === newStateGroup)?.label}
                </button>
              )}
            >
              {(close) =>
                STATE_GROUPS.map((group) => (
                  <DropdownItem
                    key={group.id}
                    selected={group.id === newStateGroup}
                    icon={<StateIcon group={group.id} />}
                    onSelect={() => {
                      setNewStateGroup(group.id);
                      close();
                    }}
                  >
                    {group.label}
                  </DropdownItem>
                ))
              }
            </Dropdown>
            <button
              type="button"
              onClick={addState}
              className="inline-flex items-center gap-1 rounded-md bg-kiran px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-600"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </Section>

        {/* ---------------- labels ---------------- */}
        <Section title="Labels">
          <ul className="divide-y divide-line-2 rounded-md border border-line">
            {labels.map((label) => {
              const count = items.filter((item) => item.labelIds.includes(label.id)).length;
              return (
                <li key={label.id} className="flex items-center gap-2.5 px-3 py-2">
                  <Dot color={label.color} />
                  <input
                    value={label.name}
                    onChange={(event) =>
                      dispatch({
                        type: 'label/patch',
                        id: label.id,
                        patch: { name: event.target.value },
                      })
                    }
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] text-ink hover:border-line focus:border-kiran/40 focus:bg-white focus:outline-none"
                  />
                  <span className="w-10 shrink-0 text-right font-mono text-[11px] text-muted">
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'label/delete', id: label.id });
                      toast.success(`Label "${label.name}" deleted`, {
                        description:
                          count > 0 ? `Removed from ${count} work items.` : undefined,
                      });
                    }}
                    aria-label={`Delete ${label.name}`}
                    className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-strand-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
            {labels.length === 0 && (
              <li className="px-3 py-3 text-[12px] text-muted">No labels yet.</li>
            )}
          </ul>

          <div className="mt-2 flex items-center gap-2">
            <input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addLabel()}
              placeholder="New label name"
              className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-[12.5px] focus:border-kiran/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={addLabel}
              className="inline-flex items-center gap-1 rounded-md bg-kiran px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-600"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </Section>

        {/* ---------------- members ---------------- */}
        <Section
          title="Members"
          hint="Compliance score and warnings come from the company directory, not from this module."
        >
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.07em] text-muted">
                <th className="py-1.5 text-left font-semibold">Member</th>
                <th className="py-1.5 text-right font-semibold">Assigned</th>
                <th className="py-1.5 text-right font-semibold">Done</th>
                <th className="py-1.5 text-right font-semibold">Overdue</th>
                <th className="py-1.5 text-right font-semibold">Hours</th>
                <th className="py-1.5 text-right font-semibold">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {load.map((row) => {
                const person = personById(row.personId);
                if (!person) return null;
                return (
                  <tr key={row.personId}>
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <Avatar
                          name={person.name}
                          initials={person.initials}
                          color={person.color}
                          size="xs"
                        />
                        <span className="text-ink">{person.name}</span>
                        {person.id === project?.leadId && (
                          <span className="rounded border border-line bg-canvas px-1 text-[9.5px] uppercase text-muted">
                            lead
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">{row.assigned}</td>
                    <td className="py-1.5 text-right font-mono">{row.done}</td>
                    <td
                      className={`py-1.5 text-right font-mono ${
                        row.overdue > 0 ? 'font-semibold text-strand-red' : ''
                      }`}
                    >
                      {row.overdue}
                    </td>
                    <td className="py-1.5 text-right font-mono">{row.hours}</td>
                    <td className="py-1.5 text-right">
                      <span
                        className={`font-mono font-semibold ${
                          person.complianceScore >= 95
                            ? 'text-strand-green'
                            : person.complianceScore >= 90
                              ? 'text-strand-amber'
                              : 'text-strand-red'
                        }`}
                      >
                        {person.complianceScore}
                      </span>
                      {person.warningsCount > 0 && (
                        <span className="ml-1.5 rounded border border-red-200 bg-red-50 px-1 text-[9.5px] text-strand-red">
                          {person.warningsCount}w
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        {/* ---------------- reset ---------------- */}
        <Section
          title="Demo data"
          hint="Restores every project, work item, comment and time entry to the seed. This is what makes the demo repeatable."
        >
          <button
            type="button"
            onClick={() => {
              resetDemoData();
              toast.success('Demo data reset', {
                description: 'Every project, work item and time entry is back to the seed.',
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-line-2"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
          </button>
        </Section>
      </div>
    </div>
  );
};
