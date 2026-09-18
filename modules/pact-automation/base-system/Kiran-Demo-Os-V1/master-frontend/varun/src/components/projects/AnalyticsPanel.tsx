/**
 * The Analytics panel — a breakdown of whatever is currently in view.
 *
 * Reads the same filtered set the layouts render, so filtering to one
 * assignee and opening Analytics shows that person's numbers. Bars are plain
 * divs: the figures are small counts, and a chart library would add nothing a
 * 6px bar and a number do not already say. Each bar is coloured by the entity
 * it stands for — the state's own colour, the priority's own colour — so the
 * colour is an identity, never a rank.
 */

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { PRIORITIES } from '@/modules/projects/constants';
import { groupOfItem, isOverdue, statesForProject } from '@/modules/projects/selectors';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import type { WorkItem } from '@/modules/projects/types';
import { Avatar, PriorityIcon, StateIcon, UnassignedAvatar } from './Glyphs';

const Bar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-2">
    <div
      style={{ width: max === 0 ? 0 : `${Math.max(2, (value / max) * 100)}%`, backgroundColor: color }}
      className="h-full rounded-full transition-[width]"
    />
  </div>
);

const Row: React.FC<{ icon: React.ReactNode; label: string; value: number; max: number; color: string }> = ({
  icon,
  label,
  value,
  max,
  color,
}) => (
  <div className="flex items-center gap-2 py-1">
    <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
    <span className="w-[6.5rem] shrink-0 truncate text-[11.5px] text-slate-700">{label}</span>
    <Bar value={value} max={max} color={color} />
    <span className="w-6 shrink-0 text-right font-mono text-[11px] text-slate-600">{value}</span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border-t border-line-2 px-4 py-3">
    <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</h3>
    {children}
  </section>
);

export const AnalyticsPanel: React.FC<{
  projectId: string;
  items: WorkItem[];
  onClose: () => void;
}> = ({ projectId, items, onClose }) => {
  const { state } = useProjects();

  const figures = useMemo(() => {
    const states = statesForProject(state, projectId);
    const byState = states.map((entry) => ({
      entry,
      count: items.filter((item) => item.stateId === entry.id).length,
    }));
    const byPriority = PRIORITIES.map((meta) => ({
      meta,
      count: items.filter((item) => item.priority === meta.id).length,
    }));

    const perPerson = new Map<string, number>();
    let unassigned = 0;
    for (const item of items) {
      if (item.assigneeIds.length === 0) unassigned += 1;
      for (const id of item.assigneeIds) perPerson.set(id, (perPerson.get(id) ?? 0) + 1);
    }
    const byAssignee = [...perPerson.entries()]
      .map(([id, count]) => ({ person: personById(id), count }))
      .filter((row) => row.person)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const done = items.filter((item) => groupOfItem(state, item) === 'completed').length;
    const started = items.filter((item) => groupOfItem(state, item) === 'started').length;
    const overdue = items.filter((item) => isOverdue(state, item)).length;
    const live = items.filter((item) => groupOfItem(state, item) !== 'cancelled');
    const points = live.reduce((sum, item) => sum + (item.estimate ?? 0), 0);
    const donePoints = live
      .filter((item) => groupOfItem(state, item) === 'completed')
      .reduce((sum, item) => sum + (item.estimate ?? 0), 0);

    return { byState, byPriority, byAssignee, unassigned, done, started, overdue, points, donePoints };
  }, [state, projectId, items]);

  const max = Math.max(1, ...figures.byState.map((row) => row.count));
  const maxPriority = Math.max(1, ...figures.byPriority.map((row) => row.count));
  const maxAssignee = Math.max(1, figures.unassigned, ...figures.byAssignee.map((row) => row.count));

  const tiles = [
    { label: 'In view', value: items.length, tone: 'text-ink' },
    { label: 'Done', value: figures.done, tone: 'text-strand-green' },
    { label: 'In progress', value: figures.started, tone: 'text-strand-amber' },
    { label: 'Overdue', value: figures.overdue, tone: figures.overdue > 0 ? 'text-strand-red' : 'text-ink' },
  ];

  return (
    <aside
      role="complementary"
      aria-label="Analytics"
      className="absolute inset-y-0 right-0 z-30 flex w-[340px] flex-col border-l border-line bg-white shadow-raised"
      style={{ animation: 'peek-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
    >
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4">
        <div>
          <span className="text-[13px] font-semibold text-ink">Analytics</span>
          <span className="ml-2 text-[11px] text-muted">for the issues in view</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-canvas hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 gap-px bg-line-2 p-px">
          {tiles.map((tile) => (
            <div key={tile.label} className="bg-white px-3 py-2.5">
              <div className={`font-mono text-[18px] font-semibold leading-none ${tile.tone}`}>{tile.value}</div>
              <div className="mt-1 text-[10.5px] text-muted">{tile.label}</div>
            </div>
          ))}
        </div>

        <Section title="State">
          {figures.byState.map(({ entry, count }) => (
            <Row
              key={entry.id}
              icon={<StateIcon group={entry.group} color={entry.color} />}
              label={entry.name}
              value={count}
              max={max}
              color={entry.color}
            />
          ))}
        </Section>

        <Section title="Priority">
          {figures.byPriority.map(({ meta, count }) => (
            <Row
              key={meta.id}
              icon={<PriorityIcon priority={meta.id} title={false} />}
              label={meta.label}
              value={count}
              max={maxPriority}
              color={meta.color}
            />
          ))}
        </Section>

        <Section title="Assignees">
          {figures.byAssignee.map(({ person, count }) =>
            person ? (
              <Row
                key={person.id}
                icon={<Avatar name={person.name} initials={person.initials} color={person.color} size="xs" />}
                label={person.name}
                value={count}
                max={maxAssignee}
                color={person.color}
              />
            ) : null,
          )}
          {figures.unassigned > 0 && (
            <Row
              icon={<UnassignedAvatar size="xs" />}
              label="Unassigned"
              value={figures.unassigned}
              max={maxAssignee}
              color="#C7D2E0"
            />
          )}
          {figures.byAssignee.length === 0 && figures.unassigned === 0 && (
            <p className="py-1 text-[11.5px] text-muted">Nothing in view.</p>
          )}
        </Section>

        <Section title="Estimate">
          <div className="flex items-center gap-2 py-1">
            <Bar value={figures.donePoints} max={figures.points} color="#06477F" />
            <span className="shrink-0 font-mono text-[11px] text-slate-600">
              {figures.donePoints} / {figures.points} pts
            </span>
          </div>
          <p className="text-[11px] text-muted">Story points completed, over points on issues that were not cancelled.</p>
        </Section>
      </div>
    </aside>
  );
};
