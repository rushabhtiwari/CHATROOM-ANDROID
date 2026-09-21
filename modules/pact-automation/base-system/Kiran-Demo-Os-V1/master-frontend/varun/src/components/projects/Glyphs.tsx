/**
 * The glyph families the project module is read by: priority, state, people,
 * labels — and the bordered property pill every row and card is built from.
 *
 * Priority and state are inline SVG rather than lucide icons because their
 * meaning is carried by *fill* — how many signal bars are solid, how full a
 * circle is — and an icon font cannot express that. They sit at 14px inside a
 * 40px row, so every path is drawn on a 16-unit grid to stay crisp.
 */

import React from 'react';
import { Component, Contrast, Layers } from 'lucide-react';
import { PRIORITY_META, STATE_GROUP_META } from '@/modules/projects/constants';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import type {
  GroupByField,
  Priority,
  StateGroup,
  WorkItemGroup,
} from '@/modules/projects/types';

/* ------------------------------------------------------------------ */
/* Priority                                                            */
/* ------------------------------------------------------------------ */

/**
 * Urgent is a filled rounded square with an exclamation mark; high, medium
 * and low are three ascending bars with 3, 2 and 1 filled; none is a faint
 * dashed square. The shape alone distinguishes them, so the meaning survives
 * greyscale and colour-blindness.
 */
export const PriorityIcon: React.FC<{
  priority: Priority;
  className?: string;
  title?: boolean;
}> = ({ priority, className = '', title = true }) => {
  const meta = PRIORITY_META[priority];
  const label = title ? `${meta.label} priority` : undefined;
  const box = `h-3.5 w-3.5 shrink-0 ${className}`;

  if (priority === 'urgent') {
    return (
      <svg viewBox="0 0 16 16" className={box} aria-label={label}>
        {label && <title>{label}</title>}
        <rect x="1" y="1" width="14" height="14" rx="3.5" fill={meta.color} />
        <rect x="7.1" y="3.6" width="1.8" height="5.6" rx="0.9" fill="#fff" />
        <circle cx="8" cy="11.6" r="1.05" fill="#fff" />
      </svg>
    );
  }

  if (priority === 'none') {
    return (
      <svg viewBox="0 0 16 16" className={box} aria-label={label}>
        {label && <title>{label}</title>}
        <rect
          x="1.75"
          y="1.75"
          width="12.5"
          height="12.5"
          rx="3"
          fill="none"
          stroke={meta.color}
          strokeWidth="1.3"
          strokeDasharray="2.4 2"
        />
      </svg>
    );
  }

  // Three bars, short to tall. Unfilled bars stay as faint outlines so the
  // glyph keeps the same footprint at every level.
  const bars = [
    { x: 1.6, y: 9.5, h: 5 },
    { x: 6.1, y: 6.2, h: 8.3 },
    { x: 10.6, y: 2.6, h: 11.9 },
  ];

  return (
    <svg viewBox="0 0 16 16" className={box} aria-label={label}>
      {label && <title>{label}</title>}
      {bars.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width="3.8"
          height={bar.h}
          rx="1.1"
          fill={index < meta.bars ? meta.color : 'transparent'}
          stroke={index < meta.bars ? 'none' : '#C7D2E0'}
          strokeWidth="1.1"
        />
      ))}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/**
 * Backlog is a dashed circle, todo an empty one, in-progress a half-filled
 * ring, done a filled circle with a check, cancelled a circle with an ×.
 *
 * The colour comes from the state itself rather than its group, because states
 * are per-project data and a project may colour "In Review" however it likes.
 */
export const StateIcon: React.FC<{
  group: StateGroup;
  color?: string;
  className?: string;
  title?: string;
}> = ({ group, color, className = '', title }) => {
  const stroke = color ?? STATE_GROUP_META[group].color;
  const label = title ?? STATE_GROUP_META[group].label;
  const box = `h-3.5 w-3.5 shrink-0 ${className}`;

  switch (group) {
    case 'backlog':
      return (
        <svg viewBox="0 0 16 16" className={box} aria-label={label}>
          <title>{label}</title>
          <circle
            cx="8"
            cy="8"
            r="6.2"
            fill="none"
            stroke={stroke}
            strokeWidth="1.6"
            strokeDasharray="2.3 2.1"
          />
        </svg>
      );

    case 'unstarted':
      return (
        <svg viewBox="0 0 16 16" className={box} aria-label={label}>
          <title>{label}</title>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke={stroke} strokeWidth="1.6" />
        </svg>
      );

    case 'started':
      return (
        <svg viewBox="0 0 16 16" className={box} aria-label={label}>
          <title>{label}</title>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke={stroke} strokeWidth="1.6" />
          <path d="M8 2.6 A5.4 5.4 0 0 1 8 13.4 Z" fill={stroke} />
        </svg>
      );

    case 'completed':
      return (
        <svg viewBox="0 0 16 16" className={box} aria-label={label}>
          <title>{label}</title>
          <circle cx="8" cy="8" r="7" fill={stroke} />
          <path
            d="M4.8 8.2 L6.9 10.3 L11.2 5.9"
            fill="none"
            stroke="#fff"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'cancelled':
    default:
      return (
        <svg viewBox="0 0 16 16" className={box} aria-label={label}>
          <title>{label}</title>
          <circle cx="8" cy="8" r="7" fill={stroke} />
          <path
            d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5"
            stroke="#fff"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};

/** The glyphs for the two relation fields, so every screen draws them alike. */
export const CycleGlyph: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Contrast className={`h-3.5 w-3.5 shrink-0 ${className}`} strokeWidth={1.8} />
);

export const ModuleGlyph: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Component className={`h-3.5 w-3.5 shrink-0 ${className}`} strokeWidth={1.8} />
);

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

const AVATAR_SIZES = {
  xs: 'h-[16px] w-[16px] text-[7.5px]',
  sm: 'h-5 w-5 text-[12px]',
  md: 'h-6 w-6 text-[12px]',
  lg: 'h-8 w-8 text-[12px]',
} as const;

export const Avatar: React.FC<{
  name: string;
  initials: string;
  color: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}> = ({ name, initials, color, size = 'sm', className = '' }) => (
  <span
    title={name}
    style={{ backgroundColor: color }}
    className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none text-white ring-1 ring-white ${AVATAR_SIZES[size]} ${className}`}
  >
    {initials}
  </span>
);

/** An empty dashed circle, so "nobody is on this" is visible rather than blank. */
export const UnassignedAvatar: React.FC<{
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}> = ({ size = 'sm', className = '' }) => (
  <span
    title="Unassigned"
    className={`inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 ${AVATAR_SIZES[size]} ${className}`}
  >
    <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" aria-hidden>
      <circle cx="8" cy="5.6" r="2.7" fill="currentColor" />
      <path d="M2.6 14.2 a5.4 5.4 0 0 1 10.8 0 Z" fill="currentColor" />
    </svg>
  </span>
);

/** Overlapping avatars with a "+n" overflow, capped so a pill stays a pill. */
export const AvatarStack: React.FC<{
  people: { id: string; name: string; initials: string; color: string }[];
  max?: number;
  size?: keyof typeof AVATAR_SIZES;
}> = ({ people, max = 3, size = 'sm' }) => {
  if (people.length === 0) return <UnassignedAvatar size={size} />;

  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <span className="flex items-center -space-x-1">
      {shown.map((person) => (
        <Avatar
          key={person.id}
          name={person.name}
          initials={person.initials}
          color={person.color}
          size={size}
        />
      ))}
      {overflow > 0 && (
        <span
          title={people.slice(max).map((person) => person.name).join(', ')}
          className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold leading-none text-slate-700 ring-1 ring-white ${AVATAR_SIZES[size]}`}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Labels and pills                                                    */
/* ------------------------------------------------------------------ */

export const LabelChip: React.FC<{
  name: string;
  color: string;
  onRemove?: () => void;
  className?: string;
}> = ({ name, color, onRemove, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-slate-700 ${className}`}
  >
    <span
      aria-hidden
      style={{ backgroundColor: color }}
      className="h-[7px] w-[7px] shrink-0 rounded-full"
    />
    {name}
    {onRemove && (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 text-slate-400 transition-colors hover:text-strand-red"
        aria-label={`Remove ${name}`}
      >
        ×
      </button>
    )}
  </span>
);

/** A plain coloured dot, used in dropdown rows and group headers. */
export const Dot: React.FC<{ color: string; className?: string }> = ({
  color,
  className = '',
}) => (
  <span
    aria-hidden
    style={{ backgroundColor: color }}
    className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
  />
);

/**
 * The bordered property pill.
 *
 * Every property on a list row, board card and table cell is one of these:
 * 22px tall, 1px border, small type, an icon and at most a few words. The
 * uniform footprint is what lets a row carry eight properties and still read
 * as a row rather than a form.
 */
export const Pill = React.forwardRef<
  HTMLSpanElement,
  {
    children: React.ReactNode;
    title?: string;
    tone?: 'default' | 'danger' | 'muted';
    className?: string;
    style?: React.CSSProperties;
    onClick?: (event: React.MouseEvent) => void;
  }
>(({ children, title, tone = 'default', className = '', style, onClick }, ref) => {
  const tones = {
    default: 'border-line bg-white text-slate-700 hover:bg-canvas',
    danger: 'border-red-200 bg-red-50 text-strand-red hover:bg-red-100/70',
    muted: 'border-line bg-white text-slate-400 hover:bg-canvas',
  };
  return (
    <span
      ref={ref}
      title={title}
      style={style}
      onClick={onClick}
      className={`inline-flex h-[22px] shrink-0 cursor-pointer select-none items-center gap-1 whitespace-nowrap rounded border px-1.5 text-[12px] leading-none transition-colors ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
});
Pill.displayName = 'Pill';

/** The "4 sub-items" pill on a parent row. */
export const SubItemCountPill: React.FC<{ count: number; expanded?: boolean; onClick?: () => void }> = ({
  count,
  expanded,
  onClick,
}) => (
  <Pill
    title={`${count} sub-item${count === 1 ? '' : 's'}${expanded ? ' · click to collapse' : ' · click to expand'}`}
    onClick={(event) => {
      if (!onClick) return;
      event.stopPropagation();
      onClick();
    }}
  >
    <Layers className="h-3 w-3 text-slate-500" strokeWidth={1.8} />
    <span className="font-mono">{count}</span>
  </Pill>
);

/* ------------------------------------------------------------------ */
/* Group headers                                                       */
/* ------------------------------------------------------------------ */

/**
 * The icon in front of a group's name — a state icon when grouped by state, a
 * priority glyph by priority, an avatar by assignee, a dot by label.
 */
export const GroupGlyph: React.FC<{ groupBy: GroupByField; group: WorkItemGroup }> = ({
  groupBy,
  group,
}) => {
  const { state } = useProjects();

  switch (groupBy) {
    case 'state': {
      const entry = state.states.byId[group.id];
      return <StateIcon group={entry?.group ?? 'backlog'} color={entry?.color} />;
    }
    case 'priority':
      return <PriorityIcon priority={group.id as Priority} />;
    case 'assignee':
    case 'createdBy': {
      const person = personById(group.id);
      return person ? (
        <Avatar name={person.name} initials={person.initials} color={person.color} size="xs" />
      ) : (
        <UnassignedAvatar size="xs" />
      );
    }
    case 'label':
      return <Dot color={group.color ?? '#C7D2E0'} />;
    case 'cycle':
      return <CycleGlyph className="text-slate-500" />;
    case 'module':
      return <ModuleGlyph className="text-slate-500" />;
    default:
      return <Dot color="#C7D2E0" />;
  }
};

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

/** The ring on a project card. Stroke-dash rather than a chart library. */
export const ProgressRing: React.FC<{
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
}> = ({ value, size = 38, stroke = 3.5, color = '#06477F', className = '' }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <svg
      width={size}
      height={size}
      className={`shrink-0 -rotate-90 ${className}`}
      aria-label={`${clamped}% complete`}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E4E9F0" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
      />
    </svg>
  );
};
