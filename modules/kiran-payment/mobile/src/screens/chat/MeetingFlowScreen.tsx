import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Video } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { UserId } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { Empty, Screen } from '~/components/Screen';
import { selection, tap, warn } from '~/native/haptics';
import { useRouteRoom } from '~/lib/useRouteRoom';

/**
 * Scheduling, as a sequence of single questions.
 *
 * This is the one flow that is *better* on a phone than in the console. The
 * console asks in a conversation, one question at a time, because that reads
 * well in a transcript — and one question at a time is exactly what a phone
 * screen wants anyway. Every answer stays on screen and stays editable: going
 * back a step is a tap, not a restart.
 */

type Step = 'who' | 'what' | 'when' | 'duration' | 'notes' | 'review';

const STEPS: Step[] = ['who', 'what', 'when', 'duration', 'notes', 'review'];

const DURATIONS = [15, 30, 45, 60, 90] as const;

/** The next seven days, which is as far ahead as anyone schedules from a phone. */
function upcomingDays(now = new Date()): Date[] {
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    day.setHours(0, 0, 0, 0);
    return day;
  });
}

/** Half-hour slots through the working day. */
const SLOTS = Array.from({ length: 20 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return { hour: Math.floor(minutes / 60), minute: minutes % 60 };
});

const labelFor = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export function MeetingFlowScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { activeRoom, rooms, userById, currentUserId, roomTitle, scheduleMeeting } = useChat();
  // The attendee list is the room's members, so it has to be the URL's room —
  // not whichever room happened to be active when this screen was opened.
  const ready = useRouteRoom(roomId);

  const [step, setStep] = useState<Step>('who');
  const [attendeeIds, setAttendeeIds] = useState<UserId[]>([]);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState<Date>(() => upcomingDays()[0]!);
  const [slot, setSlot] = useState(SLOTS[2]!);
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const members = useMemo(
    () => (activeRoom?.participantIds ?? []).filter((id) => id !== currentUserId),
    [activeRoom, currentUserId],
  );

  if (!roomId || !rooms.some((room) => room.id === roomId)) {
    return (
      <Screen back title="Schedule">
        <Empty title="Conversation not found" />
      </Screen>
    );
  }
  if (!ready) return <div className="h-full bg-canvas" aria-busy="true" />;

  const startAt = (() => {
    const at = new Date(day);
    at.setHours(slot.hour, slot.minute, 0, 0);
    return at.getTime();
  })();

  const index = STEPS.indexOf(step);
  const goBack = () => (index === 0 ? navigate(`/chats/${roomId}`) : setStep(STEPS[index - 1]!));
  const advance = () => {
    selection();
    setStep(STEPS[index + 1]!);
  };

  const canAdvance =
    step === 'who' ? attendeeIds.length > 0 : step === 'what' ? title.trim().length > 0 : true;

  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const meeting = await scheduleMeeting({
        roomId,
        attendeeIds,
        title: title.trim(),
        description: notes.trim() || undefined,
        startAt,
        durationMinutes: duration,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      // A null result is a real outcome, not an exception: without Google
      // credentials the backend cannot create a Meet link. The console says so
      // rather than pretending, and so does this.
      if (!meeting) {
        warn();
        setFailed(true);
        return;
      }
      navigate(`/chats/${roomId}`);
    } catch {
      warn();
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const question: Record<Step, string> = {
    who: 'Who should be there?',
    what: 'What is it about?',
    when: 'Which day and time?',
    duration: 'How long?',
    notes: 'Anything for the invitation?',
    review: 'Ready to send?',
  };

  return (
    <Screen
      back={goBack}
      title="Schedule a meeting"
      subtitle={roomTitle(activeRoom)}
      padBottom={false}
    >
      <div className="flex gap-1 px-4 pt-3" aria-hidden>
        {STEPS.map((name, position) => (
          <span
            key={name}
            className={cn(
              'h-1 flex-1 rounded-full',
              position <= index ? 'bg-brand' : 'bg-slate-200',
            )}
          />
        ))}
      </div>

      <h2 className="px-4 pb-1 pt-4 text-[20px] font-semibold text-ink">{question[step]}</h2>

      {step === 'who' && (
        <>
          <p className="px-4 pb-2 text-[13px] text-slate-500">
            {attendeeIds.length === 0
              ? 'Pick from this conversation.'
              : `${attendeeIds.length} selected`}
          </p>
          <div className="divide-y divide-line border-y border-line bg-surface">
            {members.map((id) => {
              const user = userById(id);
              const picked = attendeeIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    tap();
                    // Decide from `current`, not from `picked`: `picked` is
                    // this render's answer, and two taps landing before the
                    // next render would both see "not picked" and add the
                    // same person twice.
                    setAttendeeIds((current) =>
                      current.includes(id)
                        ? current.filter((entry) => entry !== id)
                        : [...current, id],
                    );
                  }}
                  className="flex min-h-touch w-full items-center gap-3 px-4 py-2.5 text-left active:bg-slate-100"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                    style={{ backgroundColor: user.color }}
                    aria-hidden
                  >
                    {user.name
                      .split(' ')
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-ink">{user.name}</span>
                    <span className="block truncate text-[12px] text-slate-500">{user.role}</span>
                  </span>
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                      picked ? 'border-brand bg-brand text-white' : 'border-slate-300',
                    )}
                  >
                    {picked && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 'what' && (
        <div className="px-4 pt-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Weekly dispatch review"
            aria-label="Meeting title"
            autoFocus
            className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-[16px] text-ink outline-none focus:border-brand"
          />
        </div>
      )}

      {step === 'when' && (
        <>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2">
            {upcomingDays().map((candidate) => {
              const picked = candidate.toDateString() === day.toDateString();
              return (
                <button
                  key={candidate.toISOString()}
                  type="button"
                  onClick={() => {
                    tap();
                    setDay(candidate);
                  }}
                  className={cn(
                    'flex min-h-[58px] w-[58px] shrink-0 flex-col items-center justify-center rounded-lg border',
                    picked
                      ? 'border-brand bg-accent text-brand'
                      : 'border-line bg-surface text-slate-600',
                  )}
                >
                  <span className="text-[11px] uppercase">
                    {candidate.toLocaleDateString('en-IN', { weekday: 'short' })}
                  </span>
                  <span className="text-[17px] font-semibold">{candidate.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-2 px-4 pb-4 pt-1">
            {SLOTS.map((candidate) => {
              const picked = candidate.hour === slot.hour && candidate.minute === slot.minute;
              return (
                <button
                  key={labelFor(candidate.hour, candidate.minute)}
                  type="button"
                  onClick={() => {
                    tap();
                    setSlot(candidate);
                  }}
                  className={cn(
                    'min-h-touch rounded-lg border text-[14px] font-medium',
                    picked
                      ? 'border-brand bg-accent text-brand'
                      : 'border-line bg-surface text-slate-600',
                  )}
                >
                  {labelFor(candidate.hour, candidate.minute)}
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 'duration' && (
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          {DURATIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => {
                tap();
                setDuration(minutes);
              }}
              className={cn(
                'min-h-[52px] rounded-lg border text-[15px] font-medium',
                duration === minutes
                  ? 'border-brand bg-accent text-brand'
                  : 'border-line bg-surface text-slate-600',
              )}
            >
              {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`}
            </button>
          ))}
        </div>
      )}

      {step === 'notes' && (
        <div className="px-4 pt-2">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={5}
            placeholder="Optional. Agenda, links, what to bring."
            aria-label="Invitation notes"
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-3 text-[16px] leading-snug text-ink outline-none focus:border-brand"
          />
        </div>
      )}

      {step === 'review' && (
        <div className="px-4 pt-2">
          <div className="rounded-lg border border-line bg-surface">
            <Line label="Title" value={title} onEdit={() => setStep('what')} />
            <Line
              label="When"
              value={`${day.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })} at ${labelFor(slot.hour, slot.minute)}`}
              onEdit={() => setStep('when')}
            />
            <Line
              label="Duration"
              value={duration < 60 ? `${duration} min` : `${duration / 60} hr`}
              onEdit={() => setStep('duration')}
            />
            <Line
              label="With"
              value={attendeeIds.map((id) => userById(id).name).join(', ')}
              onEdit={() => setStep('who')}
            />
            {notes.trim() && <Line label="Notes" value={notes} onEdit={() => setStep('notes')} />}
          </div>

          {failed && (
            <p className="mt-3 rounded-lg bg-strand-amber/10 px-3 py-2 text-[13px] leading-snug text-strand-amber">
              The meeting could not be created. Without Google credentials the backend cannot make a
              Meet link — the meeting still reaches the console's own calendar.
            </p>
          )}
        </div>
      )}

      <div className="sticky bottom-0 mt-4 border-t border-line bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {step === 'review' ? (
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={cn(
              'flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-brand text-[16px] font-semibold text-white',
              busy && 'opacity-50',
            )}
          >
            <Video className="h-5 w-5" />
            {busy ? 'Creating…' : 'Create and send invitations'}
          </button>
        ) : (
          <button
            type="button"
            onClick={advance}
            disabled={!canAdvance}
            className={cn(
              'min-h-touch w-full rounded-lg bg-brand text-[16px] font-semibold text-white',
              !canAdvance && 'opacity-40',
            )}
          >
            Continue
          </button>
        )}
      </div>
    </Screen>
  );
}

function Line({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
      <span className="w-[72px] shrink-0 text-[13px] text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 text-[14px] text-ink">{value}</span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-[13px] font-medium text-brand"
      >
        Edit
      </button>
    </div>
  );
}
