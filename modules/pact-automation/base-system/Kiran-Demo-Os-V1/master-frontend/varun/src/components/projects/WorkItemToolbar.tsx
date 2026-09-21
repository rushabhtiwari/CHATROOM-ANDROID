/**
 * The header controls — the heart of the module.
 *
 * Rendered into the project shell's header slot with a portal, so they sit on
 * the same row as the breadcrumb: search, the five-icon layout switcher,
 * Filters, Display, Analytics, and the blue Add Issue. Active filters render
 * as removable chips in a strip below the header, with a "Clear all" at the
 * end, so a filtered view always says what it is hiding.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  ChartGantt,
  List as ListIcon,
  Search,
  Sheet,
  SquareKanban,
  X,
} from 'lucide-react';
import {
  DISPLAY_PROPERTY_LABELS,
  GROUP_BY_OPTIONS,
  LAYOUTS,
  ORDER_BY_OPTIONS,
  PRIORITIES,
} from '@/modules/projects/constants';
import type { DisplayProperties } from '@/modules/projects/constants';
import {
  cyclesForProject,
  labelsForProject,
  modulesForProject,
  statesForProject,
} from '@/modules/projects/selectors';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import type { UseWorkItemsResult } from '@/modules/projects/useWorkItems';
import type { LayoutKind, Priority } from '@/modules/projects/types';
import { useHeaderSlot } from '@/pages/projects/ProjectShell';
import { DateCalendar } from './DateCalendar';
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator, ToolbarButton } from './Dropdown';
import { Avatar, CycleGlyph, Dot, ModuleGlyph, PriorityIcon, StateIcon } from './Glyphs';

const LAYOUT_ICONS: Record<LayoutKind, React.ElementType> = {
  list: ListIcon,
  board: SquareKanban,
  calendar: CalendarDays,
  table: Sheet,
  timeline: ChartGantt,
};

interface Props {
  projectId: string;
  view: UseWorkItemsResult;
  /** Layouts this screen offers. Defaults to all five. */
  available?: LayoutKind[];
  onCreate: () => void;
  analyticsOpen: boolean;
  onToggleAnalytics: () => void;
}

export const WorkItemToolbar: React.FC<Props> = ({
  projectId,
  view,
  available,
  onCreate,
  analyticsOpen,
  onToggleAnalytics,
}) => {
  const { state } = useProjects();
  const slot = useHeaderSlot();
  const { filters, setFilters, toggleFilter, clearFilters, display, toggleDisplay } = view;

  const states = statesForProject(state, projectId);
  const labels = labelsForProject(state, projectId);
  const cycles = cyclesForProject(state, projectId);
  const modules = modulesForProject(state, projectId);
  const project = state.projects.byId[projectId];
  const members = (project?.memberIds ?? [])
    .map((id) => personById(id))
    .filter((person): person is NonNullable<typeof person> => Boolean(person));

  const layouts = available ? LAYOUTS.filter((entry) => available.includes(entry.id)) : LAYOUTS;

  /* ---------------- search ---------------- */

  // The search box opens from an icon and stays open while it has text.
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchVisible = searchOpen || filters.search.length > 0;

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  /* ---------------- chips ---------------- */

  const chips: { key: string; icon?: React.ReactNode; label: string; onRemove: () => void }[] = [
    ...filters.stateIds.map((id) => {
      const entry = state.states.byId[id];
      return {
        key: `state-${id}`,
        icon: entry && <StateIcon group={entry.group} color={entry.color} className="h-3 w-3" />,
        label: entry?.name ?? 'State',
        onRemove: () => toggleFilter('stateIds', id),
      };
    }),
    ...filters.priorities.map((priority) => ({
      key: `priority-${priority}`,
      icon: <PriorityIcon priority={priority} title={false} className="h-3 w-3" />,
      label: PRIORITIES.find((entry) => entry.id === priority)?.label ?? priority,
      onRemove: () => toggleFilter('priorities', priority),
    })),
    ...filters.assigneeIds.map((id) => {
      const person = personById(id);
      return {
        key: `assignee-${id}`,
        icon: person && <Avatar name={person.name} initials={person.initials} color={person.color} size="xs" />,
        label: person?.name ?? 'Assignee',
        onRemove: () => toggleFilter('assigneeIds', id),
      };
    }),
    ...filters.labelIds.map((id) => ({
      key: `label-${id}`,
      icon: <Dot color={state.labels.byId[id]?.color ?? '#C7D2E0'} />,
      label: state.labels.byId[id]?.name ?? 'Label',
      onRemove: () => toggleFilter('labelIds', id),
    })),
    ...filters.cycleIds.map((id) => ({
      key: `cycle-${id}`,
      icon: <CycleGlyph className="h-3 w-3 text-slate-500" />,
      label: state.cycles.byId[id]?.name ?? 'Cycle',
      onRemove: () => toggleFilter('cycleIds', id),
    })),
    ...filters.moduleIds.map((id) => ({
      key: `module-${id}`,
      icon: <ModuleGlyph className="h-3 w-3 text-slate-500" />,
      label: state.modules.byId[id]?.name ?? 'Module',
      onRemove: () => toggleFilter('moduleIds', id),
    })),
  ];

  if (filters.dueFrom || filters.dueTo) {
    chips.push({
      key: 'due',
      icon: <CalendarDays className="h-3 w-3 text-slate-500" />,
      label: `Due ${filters.dueFrom ?? '…'} → ${filters.dueTo ?? '…'}`,
      onRemove: () => setFilters((prev) => ({ ...prev, dueFrom: null, dueTo: null })),
    });
  }

  /* ---------------- the controls ---------------- */

  const controls = (
    <>
      {/* Search */}
      <div className="flex items-center">
        {searchVisible ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              data-projects-search
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              onBlur={() => {
                if (!filters.search) setSearchOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setFilters((prev) => ({ ...prev, search: '' }));
                  setSearchOpen(false);
                  (event.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Search issues"
              className="h-7 w-48 rounded-md border border-line bg-white pl-7 pr-6 text-[12px] text-ink placeholder:text-muted focus:border-kiran/40 focus:outline-none"
            />
            {filters.search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, search: '' }));
                  setSearchOpen(false);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            title="Search issues · press /"
            aria-label="Search issues"
            onClick={() => setSearchOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-canvas hover:text-ink"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Layout switcher — a segmented control, active segment lifted to white */}
      <div className="flex h-7 items-center gap-px rounded-md bg-canvas p-[3px]">
        {layouts.map((entry) => {
          const Icon = LAYOUT_ICONS[entry.id];
          const active = view.layout === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => view.setLayout(entry.id)}
              title={`${entry.label} layout · press ${entry.shortcut}`}
              aria-pressed={active}
              className={`flex h-full w-7 items-center justify-center rounded-[4px] transition-colors ${
                active ? 'bg-white text-ink shadow-xs' : 'text-slate-500 hover:text-ink'
              }`}
            >
              <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Dropdown
        align="right"
        width="w-64"
        searchable
        searchPlaceholder="Search filters"
        trigger={(open) => (
          <ToolbarButton active={open || view.filtersActive} chevron>
            Filters
            {view.filtersActive && (
              <span className="rounded-full bg-kiran px-1.5 text-[12px] font-semibold text-white">
                {chips.length + (filters.search ? 1 : 0)}
              </span>
            )}
          </ToolbarButton>
        )}
      >
        {(_close, query) => {
          const q = query.toLowerCase();
          const match = (name: string) => !q || name.toLowerCase().includes(q);
          return (
            <>
              <DropdownLabel>State</DropdownLabel>
              {states.filter((entry) => match(entry.name)).map((entry) => (
                <DropdownItem
                  key={entry.id}
                  onSelect={() => toggleFilter('stateIds', entry.id)}
                  selected={filters.stateIds.includes(entry.id)}
                  icon={<StateIcon group={entry.group} color={entry.color} />}
                >
                  {entry.name}
                </DropdownItem>
              ))}

              <DropdownSeparator />
              <DropdownLabel>Priority</DropdownLabel>
              {PRIORITIES.filter((entry) => match(entry.label)).map((entry) => (
                <DropdownItem
                  key={entry.id}
                  onSelect={() => toggleFilter('priorities', entry.id as Priority)}
                  selected={filters.priorities.includes(entry.id)}
                  icon={<PriorityIcon priority={entry.id} title={false} />}
                >
                  {entry.label}
                </DropdownItem>
              ))}

              {members.length > 0 && (
                <>
                  <DropdownSeparator />
                  <DropdownLabel>Assignee</DropdownLabel>
                  {members.filter((person) => match(person.name)).map((person) => (
                    <DropdownItem
                      key={person.id}
                      onSelect={() => toggleFilter('assigneeIds', person.id)}
                      selected={filters.assigneeIds.includes(person.id)}
                      icon={<Avatar name={person.name} initials={person.initials} color={person.color} size="xs" />}
                    >
                      {person.name}
                    </DropdownItem>
                  ))}
                </>
              )}

              {labels.length > 0 && (
                <>
                  <DropdownSeparator />
                  <DropdownLabel>Label</DropdownLabel>
                  {labels.filter((entry) => match(entry.name)).map((entry) => (
                    <DropdownItem
                      key={entry.id}
                      onSelect={() => toggleFilter('labelIds', entry.id)}
                      selected={filters.labelIds.includes(entry.id)}
                      icon={<Dot color={entry.color} />}
                    >
                      {entry.name}
                    </DropdownItem>
                  ))}
                </>
              )}

              {cycles.length > 0 && (
                <>
                  <DropdownSeparator />
                  <DropdownLabel>Cycle</DropdownLabel>
                  {cycles.filter((entry) => match(entry.name)).map((entry) => (
                    <DropdownItem
                      key={entry.id}
                      onSelect={() => toggleFilter('cycleIds', entry.id)}
                      selected={filters.cycleIds.includes(entry.id)}
                      icon={<CycleGlyph className="text-slate-500" />}
                    >
                      {entry.name}
                    </DropdownItem>
                  ))}
                </>
              )}

              {modules.length > 0 && (
                <>
                  <DropdownSeparator />
                  <DropdownLabel>Module</DropdownLabel>
                  {modules.filter((entry) => match(entry.name)).map((entry) => (
                    <DropdownItem
                      key={entry.id}
                      onSelect={() => toggleFilter('moduleIds', entry.id)}
                      selected={filters.moduleIds.includes(entry.id)}
                      icon={<ModuleGlyph className="text-slate-500" />}
                    >
                      {entry.name}
                    </DropdownItem>
                  ))}
                </>
              )}

              {!q && (
                <>
                  <DropdownSeparator />
                  <DropdownLabel>Due date</DropdownLabel>
                  <div className="flex items-center gap-1 px-2 pb-1.5">
                    <DueBound
                      label={filters.dueFrom ? `From ${filters.dueFrom}` : 'From'}
                      value={filters.dueFrom}
                      onChange={(iso) => setFilters((prev) => ({ ...prev, dueFrom: iso }))}
                    />
                    <DueBound
                      label={filters.dueTo ? `To ${filters.dueTo}` : 'To'}
                      value={filters.dueTo}
                      onChange={(iso) => setFilters((prev) => ({ ...prev, dueTo: iso }))}
                    />
                  </div>
                </>
              )}
            </>
          );
        }}
      </Dropdown>

      {/* Display */}
      <Dropdown
        align="right"
        width="w-60"
        trigger={(open) => (
          <ToolbarButton active={open} chevron>
            Display
          </ToolbarButton>
        )}
      >
        <DropdownLabel>Group by</DropdownLabel>
        {GROUP_BY_OPTIONS.map((option) => (
          <DropdownItem key={option.id} onSelect={() => view.setGroupBy(option.id)} selected={view.groupBy === option.id}>
            {option.label}
          </DropdownItem>
        ))}

        <DropdownSeparator />
        <DropdownLabel>Order by</DropdownLabel>
        {ORDER_BY_OPTIONS.map((option) => (
          <DropdownItem key={option.id} onSelect={() => view.setOrderBy(option.id)} selected={view.orderBy === option.id}>
            {option.label}
          </DropdownItem>
        ))}

        <DropdownSeparator />
        <DropdownLabel>Display properties</DropdownLabel>
        <div className="flex flex-wrap gap-1 px-2.5 pb-2 pt-0.5">
          {(Object.keys(DISPLAY_PROPERTY_LABELS) as (keyof DisplayProperties)[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleDisplay(key)}
              aria-pressed={display[key]}
              className={`rounded border px-1.5 py-[2px] text-[12px] transition-colors ${
                display[key]
                  ? 'border-kiran/40 bg-kiran-tint text-kiran'
                  : 'border-line bg-white text-slate-500 hover:bg-canvas'
              }`}
            >
              {DISPLAY_PROPERTY_LABELS[key]}
            </button>
          ))}
        </div>
      </Dropdown>

      <ToolbarButton active={analyticsOpen} onClick={onToggleAnalytics}>
        Analytics
      </ToolbarButton>

      <ToolbarButton primary onClick={onCreate} title="Add issue · press C">
        Add Issue
      </ToolbarButton>
    </>
  );

  return (
    <>
      {slot ? (
        createPortal(controls, slot)
      ) : (
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-line px-3 py-1.5">{controls}</div>
      )}

      {(chips.length > 0 || filters.search) && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-surface-2 px-4 py-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-[22px] items-center gap-1 rounded border border-line bg-white pl-1.5 pr-1 text-[12px] text-slate-700"
            >
              {chip.icon}
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove filter ${chip.label}`}
                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-line hover:text-strand-red"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <span className="ml-1 font-mono text-[12px] text-muted">
            {view.items.length} of {view.totalInScope}
          </span>
          <button
            type="button"
            onClick={() => {
              clearFilters();
              setSearchOpen(false);
            }}
            className="ml-auto text-[12px] font-medium text-kiran hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </>
  );
};

/** One bound of the due-date range, as a small date pill with a calendar under it. */
const DueBound: React.FC<{
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
}> = ({ label, value, onChange }) => (
  <Dropdown
    width="w-auto"
    trigger={() => (
      <button
        type="button"
        className={`inline-flex h-6 items-center gap-1 rounded border px-1.5 text-[12px] ${
          value ? 'border-kiran/40 bg-kiran-tint text-kiran' : 'border-line bg-white text-slate-600 hover:bg-canvas'
        }`}
      >
        <CalendarDays className="h-3 w-3" />
        {label}
      </button>
    )}
  >
    {(close) => (
      <DateCalendar
        value={value}
        onChange={(iso) => {
          onChange(iso);
          close();
        }}
      />
    )}
  </Dropdown>
);
