/**
 * Scheduling a meeting as a conversation.
 *
 * Asking the assistant to set up a meeting used to throw a seven-field form on
 * top of the chat. That is a worse interaction than the one it interrupts: the
 * person had started a sentence, and the software answered with a spreadsheet.
 *
 * This asks one question at a time and keeps every answer on screen, so the
 * exchange reads back as a conversation rather than a wizard. Each step offers
 * the two or three answers that are almost always right — the room's members,
 * today or tomorrow, half an hour — with the general control underneath for
 * the times they are not. Answered steps stay visible and stay editable, and
 * nothing is sent until the review card has been seen.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  ExternalLink,
  Loader2,
  Pencil,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { meetingTitleFromPrompt } from '@/lib/meeting-intent';
import type { ScheduledMeeting, User, UserId } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { UserAvatar } from './UserAvatar';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type Step = 'attendees' | 'title' | 'date' | 'time' | 'duration' | 'agenda' | 'review';

const ORDER: Step[] = ['attendees', 'title', 'date', 'time', 'duration', 'agenda', 'review'];

const QUESTION: Record<Step, string> = {
  attendees: 'Who should be in this meeting?',
  title: 'What should I call it?',
  date: 'Which day?',
  time: 'What time?',
  duration: 'How long?',
  agenda: 'Anything to put in the invitation?',
  review: 'Here is the meeting. Shall I schedule it?',
};

interface Draft {
  attendeeIds: UserId[];
  title: string;
  /** yyyy-mm-dd, in the organiser's own zone. */
  date: string;
  /** HH:mm, 24-hour. */
  time: string;
  durationMinutes: number;
  agenda: string;
}

/* -------------------------------------------------------------------------- */
/* Date helpers — local wall-clock, never UTC                                  */
/* -------------------------------------------------------------------------- */

const pad = (value: number) => String(value).padStart(2, '0');

const toDateValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

/** Parses the two form values back into a real instant in the local zone. */
const toTimestamp = (date: string, time: string): number => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) return NaN;
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
};

/** The next half-hour boundary at least five minutes out. */
const nextSlot = () => new Date(Math.ceil((Date.now() + 5 * MINUTE) / (30 * MINUTE)) * 30 * MINUTE);

const dayLabel = (value: string): string => {
  const today = toDateValue(new Date());
  const tomorrow = toDateValue(addDays(1));
  if (value === today) return 'Today';
  if (value === tomorrow) return 'Tomorrow';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
};

const timeLabel = (value: string): string => {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour)) return value;
  const date = new Date();
  date.setHours(hour, minute || 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const durationLabel = (minutes: number) =>
  minutes >= 60
    ? minutes % 60 === 0
      ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes} minutes`;

/* -------------------------------------------------------------------------- */

export interface MeetingAgentFlowProps {
  /** What the person actually typed, used to seed a sensible title. */
  prompt: string;
  onCancel: () => void;
  onScheduled: (meeting: ScheduledMeeting) => void;
}

export const MeetingAgentFlow: React.FC<MeetingAgentFlowProps> = ({
  prompt,
  onCancel,
  onScheduled,
}) => {
  const { activeRoom, currentUserId, userById, roomTitle, scheduleMeeting } = useChat();

  const members = useMemo(
    () => activeRoom.participantIds.filter((id) => id !== currentUserId).map(userById),
    [activeRoom.participantIds, currentUserId, userById],
  );

  const [step, setStep] = useState<Step>('attendees');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledMeeting | null>(null);

  const slot = useMemo(nextSlot, []);
  const [draft, setDraft] = useState<Draft>(() => ({
    // Everyone in the room is the common case, so it is the starting position
    // rather than an empty list the person has to fill in.
    attendeeIds: members.map((member) => member.id),
    title: meetingTitleFromPrompt(prompt, `${roomTitle(activeRoom)} sync`),
    date: toDateValue(slot),
    time: `${pad(slot.getHours())}:${pad(slot.getMinutes())}`,
    durationMinutes: 30,
    agenda: '',
  }));

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  const answeredIndex = ORDER.indexOf(step);
  const answered = ORDER.slice(0, answeredIndex);

  const advance = () => {
    const next = ORDER[ORDER.indexOf(step) + 1];
    if (next) setStep(next);
  };

  const startAt = toTimestamp(draft.date, draft.time);
  const startValid = Number.isFinite(startAt) && startAt > Date.now() + MINUTE;

  /* Keep the newest question in view as the exchange grows. */
  const tailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [step, scheduled]);

  /* ------------------------------- scheduling ----------------------------- */

  const submit = async () => {
    setSaving(true);
    setError(null);
    const meeting = await scheduleMeeting({
      roomId: activeRoom.id,
      attendeeIds: draft.attendeeIds,
      title: draft.title.trim(),
      ...(draft.agenda.trim() ? { description: draft.agenda.trim() } : {}),
      startAt,
      durationMinutes: draft.durationMinutes,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setSaving(false);
    if (!meeting) {
      // scheduleMeeting has already raised a toast with the specific reason;
      // this keeps the flow open so the answer can be corrected rather than
      // making the person start again.
      setError('That did not go through. Adjust an answer and try again.');
      return;
    }
    setScheduled(meeting);
    onScheduled(meeting);
  };

  /* --------------------------------- done --------------------------------- */

  if (scheduled) {
    return (
      <div className="rounded-lg border border-line bg-surface p-3 shadow-card">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-strand-green/12 text-strand-green">
            <Check className="h-3.5 w-3.5" />
          </span>
          <p className="text-[13px] font-semibold text-ink">Meeting scheduled</p>
        </div>
        <p className="mt-2 text-[12.5px] font-medium text-ink">{scheduled.title}</p>
        <p className="mt-0.5 font-mono text-[12px] text-muted">
          {dayLabel(draft.date)} · {timeLabel(draft.time)} ·{' '}
          {durationLabel(draft.durationMinutes)}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <a
            href={scheduled.meetingUri}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-kiran px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-kiran-600"
          >
            <Video className="h-3.5 w-3.5" /> Join Meet
          </a>
          {scheduled.calendarEventUrl && (
            <a
              href={scheduled.calendarEventUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-line-2"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Google Calendar
            </a>
          )}
        </div>
        {scheduled.demo && (
          <p className="mt-2.5 border-t border-line pt-2 text-[12px] leading-relaxed text-muted">
            Google credentials are not configured on this server, so the Meet link is a
            placeholder. The Calendar link is real and opens with everything filled in. The
            meeting is on the KiranOS calendar either way.
          </p>
        )}
      </div>
    );
  }

  /* -------------------------------- in flow ------------------------------- */

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-md border border-ai/20 bg-ai-tint px-2.5 py-1.5">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-ai" />
        <p className="flex-1 text-[12px] font-medium text-ai">Scheduling a meeting</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel scheduling"
          className="rounded p-0.5 text-ai/60 transition-colors hover:bg-ai/10 hover:text-ai"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Everything already answered, still on screen and still editable. */}
      {answered.map((done) => (
        <AnsweredTurn
          key={done}
          question={QUESTION[done]}
          answer={summarise(done, draft, members)}
          onEdit={() => setStep(done)}
        />
      ))}

      <Question text={QUESTION[step]} />

      <div className="rounded-lg border border-line bg-surface p-2.5 shadow-card">
        {step === 'attendees' && (
          <AttendeeStep
            members={members}
            selected={draft.attendeeIds}
            onChange={(ids) => patch({ attendeeIds: ids })}
            onNext={advance}
          />
        )}

        {step === 'title' && (
          <TextStep
            value={draft.title}
            placeholder="Meeting title"
            onChange={(value) => patch({ title: value })}
            onNext={advance}
            canAdvance={draft.title.trim().length > 0}
          />
        )}

        {step === 'date' && (
          <DateStep value={draft.date} onChange={(date) => patch({ date })} onNext={advance} />
        )}

        {step === 'time' && (
          <TimeStep
            value={draft.time}
            date={draft.date}
            onChange={(time) => patch({ time })}
            onNext={advance}
            valid={startValid}
          />
        )}

        {step === 'duration' && (
          <DurationStep
            value={draft.durationMinutes}
            onChange={(durationMinutes) => patch({ durationMinutes })}
            onNext={advance}
          />
        )}

        {step === 'agenda' && (
          <AgendaStep
            value={draft.agenda}
            onChange={(agenda) => patch({ agenda })}
            onNext={advance}
          />
        )}

        {step === 'review' && (
          <ReviewStep
            draft={draft}
            members={members}
            organiser={userById(currentUserId)}
            startAt={startAt}
            valid={startValid}
            saving={saving}
            error={error}
            onEdit={setStep}
            onSubmit={submit}
          />
        )}
      </div>

      {step !== 'attendees' && step !== 'review' && (
        <button
          type="button"
          onClick={() => setStep(ORDER[ORDER.indexOf(step) - 1] ?? 'attendees')}
          className="inline-flex items-center gap-1 px-0.5 text-[12px] text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft className="h-3 w-3" /> Back
        </button>
      )}

      <div ref={tailRef} />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Turn rendering                                                             */
/* -------------------------------------------------------------------------- */

const Question: React.FC<{ text: string }> = ({ text }) => (
  <p className="px-0.5 text-[12.5px] font-medium leading-snug text-ink">{text}</p>
);

const AnsweredTurn: React.FC<{ question: string; answer: string; onEdit: () => void }> = ({
  question,
  answer,
  onEdit,
}) => (
  <div className="group px-0.5">
    <p className="text-[12px] text-muted">{question}</p>
    <div className="flex items-start gap-1.5">
      <p className="min-w-0 flex-1 text-[12.5px] font-medium text-ink">{answer}</p>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Change answer to: ${question}`}
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-kiran focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  </div>
);

function summarise(step: Step, draft: Draft, members: User[]): string {
  switch (step) {
    case 'attendees': {
      const names = draft.attendeeIds
        .map((id) => members.find((member) => member.id === id)?.name)
        .filter(Boolean) as string[];
      if (names.length === 0) return 'Nobody yet';
      if (names.length === members.length && members.length > 1) {
        return `Everyone in ${names.length === 1 ? 'the room' : 'this room'} — ${names.join(', ')}`;
      }
      return names.join(', ');
    }
    case 'title':
      return draft.title.trim() || 'Untitled';
    case 'date':
      return dayLabel(draft.date);
    case 'time':
      return timeLabel(draft.time);
    case 'duration':
      return durationLabel(draft.durationMinutes);
    case 'agenda':
      return draft.agenda.trim() || 'Nothing extra';
    default:
      return '';
  }
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

const NextButton: React.FC<{ onClick: () => void; disabled?: boolean; label?: string }> = ({
  onClick,
  disabled,
  label = 'Continue',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="rounded-md bg-kiran px-3 py-1.5 text-[12px] font-semibold text-white shadow-xs transition-colors hover:bg-kiran-600 disabled:opacity-40"
  >
    {label}
  </button>
);

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
      active
        ? 'border-kiran bg-kiran-tint text-kiran'
        : 'border-line bg-surface text-slate-700 hover:bg-line-2',
    )}
  >
    {children}
  </button>
);

const AttendeeStep: React.FC<{
  members: User[];
  selected: UserId[];
  onChange: (ids: UserId[]) => void;
  onNext: () => void;
}> = ({ members, selected, onChange, onNext }) => {
  const [query, setQuery] = useState('');
  const all = members.length > 0 && selected.length === members.length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      `${member.name} ${member.role} ${member.email ?? ''}`.toLowerCase().includes(needle),
    );
  }, [members, query]);

  const toggle = (id: UserId) =>
    onChange(
      selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id],
    );

  if (members.length === 0) {
    return (
      <p className="py-2 text-center text-[12px] text-muted">
        There is nobody else in this conversation to invite.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {members.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a member"
            aria-label="Find a member"
            className="w-full rounded-md border border-line bg-surface py-1.5 pl-7 pr-2 text-[12px] placeholder:text-muted focus:border-kiran focus:outline-none"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange(all ? [] : members.map((member) => member.id))}
        className="flex w-full items-center gap-2 rounded-md border border-line px-2 py-1.5 text-left transition-colors hover:bg-line-2"
      >
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
            all ? 'border-kiran bg-kiran text-white' : 'border-slate-300 bg-surface',
          )}
        >
          {all && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </span>
        <Users className="h-3.5 w-3.5 text-muted" />
        <span className="text-[12px] font-medium text-ink">Everyone in this conversation</span>
        <span className="ml-auto font-mono text-[12px] text-muted">{members.length}</span>
      </button>

      <div className="max-h-44 space-y-px overflow-y-auto">
        {filtered.map((member) => {
          const on = selected.includes(member.id);
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => toggle(member.id)}
              aria-pressed={on}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                on ? 'bg-kiran-tint' : 'hover:bg-line-2',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  on ? 'border-kiran bg-kiran text-white' : 'border-slate-300 bg-surface',
                )}
              >
                {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <UserAvatar user={member} size={22} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-ink">
                  {member.name}
                </span>
                <span className="block truncate text-[12px] text-muted">{member.role}</span>
              </span>
              {!member.email && (
                <span
                  title="No calendar address on file — this person cannot be invited"
                  className="shrink-0 rounded-badge bg-strand-amber/12 px-1.5 py-0.5 text-[12px] font-medium text-strand-amber"
                >
                  No email
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <span className="font-mono text-[12px] text-muted">{selected.length} selected</span>
        <NextButton onClick={onNext} disabled={selected.length === 0} />
      </div>
    </div>
  );
};

const TextStep: React.FC<{
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onNext: () => void;
  canAdvance: boolean;
}> = ({ value, placeholder, onChange, onNext, canAdvance }) => (
  <div className="space-y-2">
    <input
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && canAdvance) {
          event.preventDefault();
          onNext();
        }
      }}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px] placeholder:text-muted focus:border-kiran focus:outline-none"
    />
    <div className="flex justify-end">
      <NextButton onClick={onNext} disabled={!canAdvance} />
    </div>
  </div>
);

const DateStep: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
}> = ({ value, onChange, onNext }) => {
  // Today, tomorrow, then the next three days by name. Past that, the picker.
  const options = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((offset) => {
        const date = addDays(offset);
        return { value: toDateValue(date), label: dayLabel(toDateValue(date)) };
      }),
    [],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Chip
            key={option.value}
            active={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
      <input
        type="date"
        value={value}
        min={toDateValue(new Date())}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Meeting date"
        className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] focus:border-kiran focus:outline-none"
      />
      <div className="flex justify-end">
        <NextButton onClick={onNext} disabled={!value} />
      </div>
    </div>
  );
};

const TimeStep: React.FC<{
  value: string;
  date: string;
  onChange: (value: string) => void;
  onNext: () => void;
  valid: boolean;
}> = ({ value, date, onChange, onNext, valid }) => {
  // Working-day slots, with anything already past today filtered out so the
  // list never offers a time that cannot be chosen.
  const slots = useMemo(() => {
    const all = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
    const isToday = date === toDateValue(new Date());
    if (!isToday) return all;
    return all.filter((slot) => toTimestamp(date, slot) > Date.now() + 5 * MINUTE);
  }, [date]);

  return (
    <div className="space-y-2">
      {slots.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            <Chip key={slot} active={value === slot} onClick={() => onChange(slot)}>
              {timeLabel(slot)}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-muted">
          The working day is over. Pick a time below, or go back and choose another day.
        </p>
      )}
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Meeting time"
        className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] focus:border-kiran focus:outline-none"
      />
      {!valid && value && (
        <p className="text-[12px] text-strand-red">That time has already passed.</p>
      )}
      <div className="flex justify-end">
        <NextButton onClick={onNext} disabled={!valid} />
      </div>
    </div>
  );
};

const DurationStep: React.FC<{
  value: number;
  onChange: (value: number) => void;
  onNext: () => void;
}> = ({ value, onChange, onNext }) => (
  <div className="space-y-2">
    <div className="flex flex-wrap gap-1.5">
      {[15, 30, 45, 60, 90].map((minutes) => (
        <Chip key={minutes} active={value === minutes} onClick={() => onChange(minutes)}>
          {minutes >= 60 ? durationLabel(minutes) : `${minutes} min`}
        </Chip>
      ))}
    </div>
    <div className="flex justify-end">
      <NextButton onClick={onNext} />
    </div>
  </div>
);

const AgendaStep: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
}> = ({ value, onChange, onNext }) => (
  <div className="space-y-2">
    <textarea
      autoFocus
      rows={3}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Agenda or context for the invitation"
      aria-label="Agenda"
      className="w-full resize-none rounded-md border border-line bg-surface px-2.5 py-2 text-[12.5px] placeholder:text-muted focus:border-kiran focus:outline-none"
    />
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onNext}
        className="text-[12px] font-medium text-muted transition-colors hover:text-ink"
      >
        Skip
      </button>
      <NextButton onClick={onNext} label="Review" />
    </div>
  </div>
);

const ReviewStep: React.FC<{
  draft: Draft;
  members: User[];
  organiser: User;
  startAt: number;
  valid: boolean;
  saving: boolean;
  error: string | null;
  onEdit: (step: Step) => void;
  onSubmit: () => void;
}> = ({ draft, members, organiser, startAt, valid, saving, error, onEdit, onSubmit }) => {
  const attendees = draft.attendeeIds
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean) as User[];
  const missingEmail = attendees.filter((attendee) => !attendee.email);
  const endsAt = startAt + draft.durationMinutes * MINUTE;

  const rows: Array<{ step: Step; label: string; value: string }> = [
    { step: 'title', label: 'Title', value: draft.title.trim() || 'Untitled' },
    { step: 'date', label: 'Day', value: dayLabel(draft.date) },
    {
      step: 'time',
      label: 'Time',
      value: `${timeLabel(draft.time)} – ${new Date(endsAt).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })}`,
    },
    { step: 'duration', label: 'Duration', value: durationLabel(draft.durationMinutes) },
  ];
  if (draft.agenda.trim()) {
    rows.push({ step: 'agenda', label: 'Agenda', value: draft.agenda.trim() });
  }

  return (
    <div className="space-y-2.5">
      <dl className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.step} className="group flex items-start gap-2">
            <dt className="w-16 shrink-0 pt-px text-[12px] text-muted">
              {row.label}
            </dt>
            <dd className="min-w-0 flex-1 text-[12px] font-medium text-ink">{row.value}</dd>
            <button
              type="button"
              onClick={() => onEdit(row.step)}
              aria-label={`Change ${row.label.toLowerCase()}`}
              className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-kiran focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        ))}

        <div className="group flex items-start gap-2">
          <dt className="w-16 shrink-0 pt-px text-[12px] text-muted">
            Guests
          </dt>
          <dd className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1">
              {attendees.map((attendee) => (
                <span
                  key={attendee.id}
                  className="inline-flex items-center gap-1 rounded-badge bg-line-2 py-0.5 pl-0.5 pr-1.5"
                >
                  <UserAvatar user={attendee} size={16} />
                  <span className="text-[12px] font-medium text-slate-700">
                    {attendee.name}
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-1 text-[12px] text-muted">
              Organised by {organiser.name}
            </p>
          </dd>
          <button
            type="button"
            onClick={() => onEdit('attendees')}
            aria-label="Change guests"
            className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-kiran focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </dl>

      {missingEmail.length > 0 && (
        <p className="rounded-md bg-strand-amber/10 px-2 py-1.5 text-[12px] leading-relaxed text-strand-amber">
          {missingEmail.map((person) => person.name).join(', ')}{' '}
          {missingEmail.length === 1 ? 'has' : 'have'} no calendar address on file, so the
          invitation cannot be sent to {missingEmail.length === 1 ? 'them' : 'them'}.
        </p>
      )}

      {!valid && (
        <p className="text-[12px] text-strand-red">
          The start time has passed. Change the day or the time.
        </p>
      )}
      {error && <p className="text-[12px] text-strand-red">{error}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={saving || !valid || attendees.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-kiran px-3 py-2 text-[12px] font-semibold text-white shadow-xs transition-colors hover:bg-kiran-600 disabled:opacity-40"
      >
        {saving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating the Meet link…
          </>
        ) : (
          <>
            <Video className="h-3.5 w-3.5" /> Schedule meeting
          </>
        )}
      </button>
      <p className="flex items-center justify-center gap-1 text-[12px] text-muted">
        <Clock3 className="h-2.5 w-2.5" />
        Creates a Google Meet link and invites everyone listed
      </p>
    </div>
  );
};

export default MeetingAgentFlow;
