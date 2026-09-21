/**
 * The inline property editors.
 *
 * Every one of these renders in three places, selected by `variant`:
 *
 *   pill   the bordered 22px chip on a list row or board card
 *   cell   a table cell — icon and text, filling the cell
 *   field  a label/value row in the peek panel's right rail
 *
 * That is the point of the module — in Plane you should almost never have to
 * open an item to change something about it. Each picker takes the current
 * value and an onChange and dispatches nothing itself, so the same picker
 * serves an existing item (patch it) and the create modal (hold a draft).
 */

import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarCheck2, CalendarDays, Hash, Tag, Users, X } from 'lucide-react';
import { ESTIMATE_POINTS, PRIORITIES, PRIORITY_META } from '@/modules/projects/constants';
import {
  cyclesForProject,
  labelsForProject,
  modulesForProject,
  rootWorkItems,
  statesForProject,
  displayId,
} from '@/modules/projects/selectors';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import type { Priority } from '@/modules/projects/types';
import { DateCalendar } from './DateCalendar';
import { Dropdown, DropdownItem, DropdownNote, DropdownSeparator } from './Dropdown';
import {
  Avatar,
  AvatarStack,
  CycleGlyph,
  Dot,
  LabelChip,
  ModuleGlyph,
  Pill,
  PriorityIcon,
  StateIcon,
} from './Glyphs';

export type PickerVariant = 'pill' | 'field' | 'cell';

/* ------------------------------------------------------------------ */
/* Trigger                                                             */
/* ------------------------------------------------------------------ */

/** The clickable surface, drawn three ways. */
const Trigger: React.FC<{
  variant: PickerVariant;
  title?: string;
  tone?: 'default' | 'danger' | 'muted';
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ variant, title, tone = 'default', className = '', style, children }) => {
  if (variant === 'pill') {
    return (
      <Pill title={title} tone={tone} className={className} style={style}>
        {children}
      </Pill>
    );
  }
  if (variant === 'cell') {
    return (
      <button
        type="button"
        title={title}
        className={`flex h-full w-full min-w-0 items-center gap-1.5 px-2.5 text-left text-[12px] ${
          tone === 'danger' ? 'text-strand-red' : 'text-slate-700'
        } ${className}`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      title={title}
      className={`flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px] transition-colors hover:bg-canvas ${
        tone === 'danger' ? 'text-strand-red' : 'text-slate-700'
      } ${className}`}
    >
      {children}
    </button>
  );
};

/** The muted text an unset property shows. */
const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="truncate text-muted">{children}</span>
);

const dropdownClass = (variant: PickerVariant) => (variant === 'cell' ? 'h-full w-full' : 'max-w-full');

const fmt = (iso: string) => format(parseISO(iso), 'MMM d, yyyy');

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export const StatePicker: React.FC<{
  projectId: string;
  value: string;
  onChange: (stateId: string) => void;
  variant?: PickerVariant;
}> = ({ projectId, value, onChange, variant = 'field' }) => {
  const { state } = useProjects();
  const states = statesForProject(state, projectId);
  const current = state.states.byId[value];

  return (
    <Dropdown
      width="w-52"
      searchable
      className={dropdownClass(variant)}
      trigger={() => (
        <Trigger variant={variant} title="Change state">
          <StateIcon group={current?.group ?? 'backlog'} color={current?.color} />
          <span className="truncate">{current?.name ?? 'None'}</span>
        </Trigger>
      )}
    >
      {(close, query) =>
        states
          .filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase()))
          .map((entry) => (
            <DropdownItem
              key={entry.id}
              selected={entry.id === value}
              icon={<StateIcon group={entry.group} color={entry.color} />}
              onSelect={() => {
                onChange(entry.id);
                close();
              }}
            >
              {entry.name}
            </DropdownItem>
          ))
      }
    </Dropdown>
  );
};

/* ------------------------------------------------------------------ */
/* Priority                                                            */
/* ------------------------------------------------------------------ */

export const PriorityPicker: React.FC<{
  value: Priority;
  onChange: (priority: Priority) => void;
  variant?: PickerVariant;
}> = ({ value, onChange, variant = 'field' }) => {
  const meta = PRIORITY_META[value];
  // The pill is tinted by its priority — a red-bordered box for urgent, an
  // orange one for high — so a column of them scans without reading.
  const tint =
    variant === 'pill' && value !== 'none'
      ? { borderColor: `${meta.color}66`, backgroundColor: `${meta.color}14` }
      : undefined;

  return (
    <Dropdown
      width="w-44"
      className={dropdownClass(variant)}
      trigger={() => (
        <Trigger variant={variant} title={`${meta.label} priority`} style={tint}>
          <PriorityIcon priority={value} title={false} />
          {variant !== 'pill' && <span className="truncate">{meta.label}</span>}
        </Trigger>
      )}
    >
      {(close) =>
        PRIORITIES.map((entry) => (
          <DropdownItem
            key={entry.id}
            selected={entry.id === value}
            icon={<PriorityIcon priority={entry.id} title={false} />}
            onSelect={() => {
              onChange(entry.id);
              close();
            }}
          >
            {entry.label}
          </DropdownItem>
        ))
      }
    </Dropdown>
  );
};

/* ------------------------------------------------------------------ */
/* Assignees                                                           */
/* ------------------------------------------------------------------ */

/** Multi-select, so the panel stays open while several people are ticked. */
export const AssigneePicker: React.FC<{
  projectId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  variant?: PickerVariant;
  compact?: boolean;
}> = ({ projectId, value, onChange, variant = 'field', compact }) => {
  const { state } = useProjects();
  const project = state.projects.byId[projectId];
  const members = (project?.memberIds ?? [])
    .map((id) => personById(id))
    .filter((person): person is NonNullable<typeof person> => Boolean(person));
  const selected = value
    .map((id) => personById(id))
    .filter((person): person is NonNullable<typeof person> => Boolean(person));

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id]);

  const text =
    selected.length === 0
      ? variant === 'cell'
        ? 'Assignees'
        : 'Unassigned'
      : selected.length === 1
        ? selected[0].name
        : `${selected.length} assignees`;

  return (
    <Dropdown
      width="w-60"
      searchable
      searchPlaceholder="Search members"
      className={dropdownClass(variant)}
      trigger={() => (
        <Trigger variant={variant} title="Change assignees">
          {selected.length > 0 ? (
            <AvatarStack people={selected} size="xs" max={variant === 'pill' || compact ? 2 : 3} />
          ) : (
            <Users className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.8} />
          )}
          {variant !== 'pill' && !compact && (
            <span className={selected.length === 0 ? 'text-muted' : ''}>{text}</span>
          )}
        </Trigger>
      )}
    >
      {(_close, query) => (
        <>
          {members.length === 0 && <DropdownNote>No members in this project.</DropdownNote>}
          {members
            .filter((person) => person.name.toLowerCase().includes(query.toLowerCase()))
            .map((person) => {
              const checked = value.includes(person.id);
              return (
                <DropdownItem
                  key={person.id}
                  selected={checked}
                  icon={<Avatar name={person.name} initials={person.initials} color={person.color} size="xs" />}
                  onSelect={() => toggle(person.id)}
                >
                  <span className="truncate">{person.name}</span>
                </DropdownItem>
              );
            })}
          {value.length > 0 && (
            <>
              <DropdownSeparator />
              <DropdownItem onSelect={() => onChange([])} danger>
                Clear assignees
              </DropdownItem>
            </>
          )}
        </>
      )}
    </Dropdown>
  );
};

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export const LabelPicker: React.FC<{
  projectId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  variant?: PickerVariant;
  compact?: boolean;
}> = ({ projectId, value, onChange, variant = 'field', compact }) => {
  const { state } = useProjects();
  const labels = labelsForProject(state, projectId);
  const selected = value.map((id) => state.labels.byId[id]).filter(Boolean);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id]);

  const shown = variant === 'pill' || compact ? selected.slice(0, 2) : selected;
  const overflow = selected.length - shown.length;

  return (
    <Dropdown
      width="w-56"
      searchable
      searchPlaceholder="Search labels"
      className={dropdownClass(variant)}
      trigger={() => (
        <Trigger variant={variant} title="Change labels" className={variant === 'field' && !compact ? 'flex-wrap' : ''}>
          {selected.length === 0 ? (
            <>
              <Tag className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.8} />
              {variant !== 'pill' && !compact && <Empty>{variant === 'cell' ? 'Select labels' : 'No labels'}</Empty>}
            </>
          ) : (
            <>
              {shown.map((label) => (
                <LabelChip key={label.id} name={label.name} color={label.color} />
              ))}
              {overflow > 0 && <span className="text-[12px] text-muted">+{overflow}</span>}
            </>
          )}
        </Trigger>
      )}
    >
      {(_close, query) => (
        <>
          {labels.length === 0 && <DropdownNote>This project has no labels yet.</DropdownNote>}
          {labels
            .filter((label) => label.name.toLowerCase().includes(query.toLowerCase()))
            .map((label) => (
              <DropdownItem
                key={label.id}
                selected={value.includes(label.id)}
                icon={<Dot color={label.color} />}
                onSelect={() => toggle(label.id)}
              >
                {label.name}
              </DropdownItem>
            ))}
        </>
      )}
    </Dropdown>
  );
};

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export const DatePicker: React.FC<{
  value: string | null;
  onChange: (iso: string | null) => void;
  /** Which calendar glyph to draw, and the placeholder text. */
  kind?: 'start' | 'due';
  variant?: PickerVariant;
  overdue?: boolean;
  min?: string | null;
  max?: string | null;
  placeholder?: string;
}> = ({ value, onChange, kind = 'due', variant = 'field', overdue, min, max, placeholder: customPlaceholder }) => {
  const Icon = kind === 'start' ? CalendarDays : CalendarCheck2;
  const placeholder = customPlaceholder ?? (kind === 'start' ? 'Start date' : 'Due date');

  return (
    <Dropdown
      width="w-auto"
      className={dropdownClass(variant)}
      trigger={() => (
        <Trigger variant={variant} title={`Change ${placeholder.toLowerCase()}`} tone={overdue ? 'danger' : 'default'}>
          <Icon
            className={`h-3.5 w-3.5 shrink-0 ${overdue ? 'text-strand-red' : 'text-slate-500'}`}
            strokeWidth={1.8}
          />
          {value ? (
            <>
              <span className="truncate">{fmt(value)}</span>
              {variant === 'pill' && (
                <button
                  type="button"
                  aria-label={`Clear ${placeholder.toLowerCase()}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(null);
                  }}
                  className="-mr-0.5 rounded p-[1px] text-slate-400 hover:bg-line hover:text-slate-700"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </>
          ) : (
            variant !== 'pill' && <Empty>{variant === 'cell' ? placeholder : `No ${placeholder.toLowerCase()}`}</Empty>
          )}
        </Trigger>
      )}
    >
      {(close) => (
        <DateCalendar
          value={value}
          min={min}
          max={max}
          onChange={(iso) => {
            onChange(iso);
            close();
          }}
        />
      )}
    </Dropdown>
  );
};

/* ------------------------------------------------------------------ */
/* Estimate                                                            */
/* ------------------------------------------------------------------ */

export const EstimatePicker: React.FC<{
  value: number | null;
  onChange: (points: number | null) => void;
  variant?: PickerVariant;
}> = ({ value, onChange, variant = 'field' }) => (
  <Dropdown
    width="w-40"
    className={dropdownClass(variant)}
    trigger={() => (
      <Trigger variant={variant} title="Change estimate">
        <Hash className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.8} />
        {value === null ? (
          variant !== 'pill' && <Empty>{variant === 'cell' ? 'Estimate' : 'No estimate'}</Empty>
        ) : (
          <span className="font-mono">{variant === 'pill' ? value : `${value} points`}</span>
        )}
      </Trigger>
    )}
  >
    {(close) => (
      <>
        {ESTIMATE_POINTS.map((points) => (
          <DropdownItem
            key={points}
            selected={value === points}
            onSelect={() => {
              onChange(points);
              close();
            }}
          >
            {points} {points === 1 ? 'point' : 'points'}
          </DropdownItem>
        ))}
        {value !== null && (
          <>
            <DropdownSeparator />
            <DropdownItem
              danger
              onSelect={() => {
                onChange(null);
                close();
              }}
            >
              Clear estimate
            </DropdownItem>
          </>
        )}
      </>
    )}
  </Dropdown>
);

/* ------------------------------------------------------------------ */
/* Cycle, module, parent                                               */
/* ------------------------------------------------------------------ */

/** Cycle and module are the same shape, so one component serves both. */
const RelationPicker: React.FC<{
  options: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  icon: React.ReactNode;
  noun: string;
  variant: PickerVariant;
}> = ({ options, value, onChange, icon, noun, variant }) => {
  const current = options.find((option) => option.id === value);

  return (
    <Dropdown
      width="w-60"
      searchable
      searchPlaceholder={`Search ${noun}s`}
      className={dropdownClass(variant)}
      trigger={() => (
        <Trigger variant={variant} title={`Change ${noun}`}>
          {icon}
          {current ? (
            <span className={`truncate ${variant === 'pill' ? 'max-w-[9rem]' : ''}`}>{current.name}</span>
          ) : (
            variant !== 'pill' && <Empty>{variant === 'cell' ? `Select ${noun}` : `No ${noun}`}</Empty>
          )}
        </Trigger>
      )}
    >
      {(close, query) => (
        <>
          <DropdownItem
            selected={value === null}
            onSelect={() => {
              onChange(null);
              close();
            }}
          >
            No {noun}
          </DropdownItem>
          {options.length > 0 && <DropdownSeparator />}
          {options
            .filter((option) => option.name.toLowerCase().includes(query.toLowerCase()))
            .map((option) => (
              <DropdownItem
                key={option.id}
                selected={option.id === value}
                onSelect={() => {
                  onChange(option.id);
                  close();
                }}
              >
                {option.name}
              </DropdownItem>
            ))}
        </>
      )}
    </Dropdown>
  );
};

export const CyclePicker: React.FC<{
  projectId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  variant?: PickerVariant;
}> = ({ projectId, value, onChange, variant = 'field' }) => {
  const { state } = useProjects();
  return (
    <RelationPicker
      options={cyclesForProject(state, projectId)}
      value={value}
      onChange={onChange}
      icon={<CycleGlyph className="text-slate-500" />}
      noun="cycle"
      variant={variant}
    />
  );
};

export const ModulePicker: React.FC<{
  projectId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  variant?: PickerVariant;
}> = ({ projectId, value, onChange, variant = 'field' }) => {
  const { state } = useProjects();
  return (
    <RelationPicker
      options={modulesForProject(state, projectId)}
      value={value}
      onChange={onChange}
      icon={<ModuleGlyph className="text-slate-500" />}
      noun="module"
      variant={variant}
    />
  );
};

/**
 * Parent picker. Offers only top-level items, and never the item itself —
 * sub-items are one level deep, and the reducer would reject anything else.
 */
export const ParentPicker: React.FC<{
  projectId: string;
  itemId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}> = ({ projectId, itemId, value, onChange }) => {
  const { state } = useProjects();
  const [query, setQuery] = useState('');

  const hasChildren = state.workItems.allIds.some(
    (id) => state.workItems.byId[id].parentId === itemId,
  );

  const candidates = rootWorkItems(state, projectId)
    .filter((item) => item.id !== itemId)
    .filter((item) =>
      query ? `${displayId(state, item)} ${item.title}`.toLowerCase().includes(query.toLowerCase()) : true,
    )
    .slice(0, 40);

  const current = value ? state.workItems.byId[value] : undefined;

  return (
    <Dropdown
      width="w-72"
      className="max-w-full"
      trigger={() => (
        <Trigger variant="field">
          {current ? (
            <span className="truncate">
              <span className="font-mono text-[12px] text-muted">{displayId(state, current)}</span>{' '}
              {current.title}
            </span>
          ) : (
            <Empty>No parent</Empty>
          )}
        </Trigger>
      )}
    >
      {(close) =>
        hasChildren ? (
          <DropdownNote>This item has sub-items of its own, so it cannot also be a sub-item.</DropdownNote>
        ) : (
          <>
            <div className="px-2 pb-1 pt-1">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search issues"
                className="w-full rounded border border-line px-2 py-1 text-[12px] focus:border-kiran/40 focus:outline-none"
              />
            </div>
            <DropdownItem
              selected={value === null}
              onSelect={() => {
                onChange(null);
                close();
              }}
            >
              No parent
            </DropdownItem>
            <DropdownSeparator />
            {candidates.map((item) => (
              <DropdownItem
                key={item.id}
                selected={item.id === value}
                onSelect={() => {
                  onChange(item.id);
                  close();
                }}
              >
                <span className="font-mono text-[12px] text-muted">{displayId(state, item)}</span>{' '}
                {item.title}
              </DropdownItem>
            ))}
          </>
        )
      }
    </Dropdown>
  );
};
