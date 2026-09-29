import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Phone, PhoneCall, Video, WifiOff } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { cn } from '@/lib/utils';
import { Empty, Screen } from '~/components/Screen';
import { PersonAvatar } from '~/components/Avatar';
import { Sheet } from '~/components/Sheet';
import { tap } from '~/native/haptics';
import { isMissed, useCalls } from '~/calls/CallProvider';
import { callDuration } from '~/calls/CallScreen';
import { callNative } from '~/calls/native';
import type { CallMedia, CallRecord } from '~/calls/types';

const DAY = 86_400_000;

/** "Today, 09:42", "Yesterday, 18:10", "14 Aug, 11:05". */
function callTime(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (timestamp >= startOfToday) return `Today, ${time}`;
  if (timestamp >= startOfToday - DAY) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

/** What happened, from this person's side of the call. */
function describe(record: CallRecord, outgoing: boolean): string {
  if (record.status !== 'ended') return 'Ongoing';
  if (outgoing) {
    if (record.outcome === 'completed') return 'Outgoing';
    if (record.outcome === 'declined') return 'Declined';
    if (record.outcome === 'busy') return 'Busy';
    return 'No answer';
  }
  if (record.outcome === 'completed') return 'Incoming';
  if (record.outcome === 'declined') return 'Declined';
  return 'Missed';
}

function CallButton({
  media,
  name,
  onCall,
}: {
  media: CallMedia;
  name: string;
  onCall: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        tap();
        onCall();
      }}
      aria-label={`${media === 'video' ? 'Video' : 'Voice'} call ${name}`}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand active:bg-slate-100"
    >
      {media === 'video' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
    </button>
  );
}

/**
 * The call list, like a phone's own: who, which way, when and how long, with
 * the calls nobody answered in red. The button on each row calls back the
 * same way; the row itself opens the person.
 */
export function CallsScreen() {
  const calls = useCalls();
  const { currentUserId, userById, users } = useChat();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const { markSeen, history } = calls;

  // Looking at the list is what clears the missed-call badge — including for
  // a call that arrives while it is open.
  useEffect(() => {
    markSeen();
  }, [markSeen, history]);

  // A call that rings while the app is in the background is a notification,
  // which Android 13 and later have to be allowed to show.
  useEffect(() => {
    if (calls.enabled) callNative.askForNotifications();
  }, [calls.enabled]);

  if (!calls.enabled) {
    return (
      <Screen title="Calls">
        <Empty
          title="Calls need the KiranOS server"
          detail="This build of the app runs without one, so there is nobody for it to ring."
        />
      </Screen>
    );
  }

  const others = users.filter((user) => user.id !== currentUserId);
  const call = (peerId: string, media: CallMedia, roomId: string | null = null) => {
    setPicking(false);
    calls.start(peerId, media, roomId);
  };

  return (
    <Screen
      title="Calls"
      action={
        <button
          type="button"
          onClick={() => {
            tap();
            setPicking(true);
          }}
          aria-label="New call"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-brand active:bg-slate-100"
        >
          <PhoneCall className="h-5 w-5" />
        </button>
      }
    >
      {!calls.connected && (
        <div className="flex items-center gap-2 bg-strand-amber/10 px-4 py-2 text-[13px] text-strand-amber">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Not connected to the call server. Calls cannot reach this phone until it is.</span>
        </div>
      )}

      {history.length === 0 ? (
        <Empty
          title={calls.historyFailed ? 'The call list did not load' : 'No calls yet'}
          detail={
            calls.historyFailed
              ? 'It loads again once the app reaches the server.'
              : 'Call someone from a chat, or with the phone button above.'
          }
        />
      ) : (
        <ul
          className="divide-y divide-line border-y border-line bg-surface"
          aria-label="Recent calls"
        >
          {history.map((record) => {
            const outgoing = record.from === currentUserId;
            const peerId = outgoing ? record.to : record.from;
            const peer = userById(peerId);
            const missed = isMissed(record, currentUserId);
            const Arrow = outgoing ? ArrowUpRight : ArrowDownLeft;
            const talked =
              record.answeredAt && record.endedAt
                ? ` · ${callDuration(record.endedAt - record.answeredAt)}`
                : '';
            return (
              <li key={record.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    tap();
                    navigate(`/people/${peerId}`);
                  }}
                  className="flex min-h-touch w-full items-center gap-3 px-4 py-2.5 active:bg-slate-100"
                >
                  <PersonAvatar user={peer} size={44} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-[15px] font-medium',
                        missed ? 'text-destructive' : 'text-ink',
                      )}
                    >
                      {peer.name}
                    </p>
                    <p className="flex items-center gap-1 truncate text-[13px] text-slate-500">
                      <Arrow
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          missed ? 'text-destructive' : outgoing ? 'text-brand' : 'text-online',
                        )}
                        aria-hidden
                      />
                      <span className="truncate">
                        {describe(record, outgoing)} · {callTime(record.startedAt)}
                        {talked}
                      </span>
                    </p>
                  </div>
                  <CallButton
                    media={record.media}
                    name={peer.name}
                    onCall={() => call(peerId, record.media, record.roomId)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {picking && (
        <Sheet onClose={() => setPicking(false)} title="New call">
          {others.length === 0 ? (
            <p className="px-6 pb-4 text-center text-[13px] text-slate-500">
              There is nobody else in the directory to call.
            </p>
          ) : (
            <ul className="border-t border-line">
              {others.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-2"
                >
                  <PersonAvatar user={user} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">{user.name}</p>
                    <p className="truncate text-[12px] text-slate-500">{user.role}</p>
                  </div>
                  <CallButton
                    media="audio"
                    name={user.name}
                    onCall={() => call(user.id, 'audio')}
                  />
                  <CallButton
                    media="video"
                    name={user.name}
                    onCall={() => call(user.id, 'video')}
                  />
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </Screen>
  );
}
