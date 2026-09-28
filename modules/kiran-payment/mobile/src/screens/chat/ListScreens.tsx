import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AtSign, Bell, Search } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { notificationIsRead } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { Empty, Row, Screen } from '~/components/Screen';
import { MessageList, useOpenMessage } from '~/components/MessageList';
import { PersonAvatar } from '~/components/Avatar';
import { RoomAvatar } from '~/components/RoomAvatar';
import { relativeTime, upcomingTime } from '~/lib/format';

/** Messages you saved, from every conversation. */
export function SavedScreen() {
  const { savedMessages } = useChat();
  return (
    <Screen back title="Saved messages">
      <MessageList
        messages={savedMessages()}
        emptyTitle="Nothing saved yet"
        emptyDetail="Long-press a message and choose Save to keep it here."
      />
    </Screen>
  );
}

/** A conversation's pinned messages, newest pin first. */
export function PinnedScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const { pinnedMessages, togglePin } = useChat();
  return (
    <Screen back title="Pinned messages">
      <MessageList
        messages={roomId ? pinnedMessages(roomId) : []}
        showRoom={false}
        emptyTitle="Nothing pinned"
        emptyDetail="Long-press a message and choose Pin to keep it at the top."
        trailing={(message) => (
          <button
            type="button"
            onClick={() => togglePin(message.id)}
            className="text-[13px] font-medium text-slate-500"
          >
            Unpin
          </button>
        )}
      />
    </Screen>
  );
}

/** Messages waiting to go out, with the two things you might want to do to them. */
export function ScheduledScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const { scheduledMessages, cancelScheduled, sendScheduledNow } = useChat();
  const queued = roomId ? scheduledMessages(roomId) : [];
  return (
    <Screen back title="Scheduled messages">
      {queued.length === 0 ? (
        <Empty
          title="Nothing scheduled"
          detail="In a conversation, tap + and choose Schedule to send something later."
        />
      ) : (
        <ul className="divide-y divide-line border-y border-line bg-surface">
          {queued.map((message) => (
            <li key={message.id} className="px-4 py-3">
              <p className="text-[12px] font-semibold text-brand">
                {upcomingTime(message.scheduledFor ?? message.timestamp)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[15px] text-ink">{message.content}</p>
              <div className="mt-2 flex gap-4">
                <button
                  type="button"
                  onClick={() => sendScheduledNow(message.id)}
                  className="text-[14px] font-medium text-brand"
                >
                  Send now
                </button>
                <button
                  type="button"
                  onClick={() => cancelScheduled(message.id)}
                  className="text-[14px] font-medium text-destructive"
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

/** What happened in a conversation that concerns you: mentions, and the rest. */
export function ActivityScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const {
    notificationsFor,
    markNotificationRead,
    markRoomNotificationsRead,
    currentUserId,
    userById,
    messageById,
  } = useChat();
  const open = useOpenMessage();
  const [filter, setFilter] = useState<'all' | 'mentions'>('all');
  const all = roomId ? notificationsFor(roomId) : [];
  const shown = filter === 'mentions' ? all.filter((n) => n.kind === 'mention') : all;
  const unread = all.filter((n) => !notificationIsRead(n, currentUserId)).length;

  return (
    <Screen
      back
      title="Activity"
      action={
        unread > 0 && roomId ? (
          <button
            type="button"
            onClick={() => markRoomNotificationsRead(roomId)}
            className="px-2 text-[14px] font-medium text-brand"
          >
            Mark all read
          </button>
        ) : undefined
      }
    >
      <div className="flex gap-2 bg-surface px-4 py-2">
        {(['all', 'mentions'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'h-8 rounded-full px-3 text-[13px] font-medium',
              filter === value ? 'bg-brand text-white' : 'bg-slate-100 text-ink',
            )}
          >
            {value === 'all' ? 'Everything' : 'Mentions'}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty title="Nothing here" detail="Mentions and replies to you show up here." />
      ) : (
        <ul className="divide-y divide-line border-y border-line bg-surface">
          {shown.map((notification) => {
            const read = notificationIsRead(notification, currentUserId);
            const message = notification.messageId
              ? messageById(notification.messageId)
              : undefined;
            return (
              <li key={notification.id}>
                <Row
                  onClick={() => {
                    markNotificationRead(notification.id);
                    if (message) open(message);
                  }}
                >
                  {notification.actorId ? (
                    <PersonAvatar user={userById(notification.actorId)} size={36} />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-brand">
                      <Bell className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[14px] text-ink', !read && 'font-semibold')}>
                      {notification.kind === 'mention' && (
                        <AtSign className="mr-1 inline h-3.5 w-3.5 text-brand" />
                      )}
                      {notification.text}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {relativeTime(notification.timestamp)}
                    </p>
                  </div>
                  {!read && (
                    <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-label="Unread" />
                  )}
                </Row>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}

/** Search every message you can see, or one conversation's (`?room=`). */
export function SearchScreen() {
  const [params] = useSearchParams();
  const roomId = params.get('room') ?? undefined;
  const { searchMessages, rooms, roomTitle } = useChat();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const room = rooms.find((candidate) => candidate.id === roomId);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(
    () => searchMessages(debounced, roomId),
    [searchMessages, debounced, roomId],
  );

  return (
    <Screen back title={room ? `Search ${roomTitle(room)}` : 'Search messages'}>
      <div className="bg-surface px-4 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search messages"
            aria-label="Search messages"
            className="h-9 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
      {debounced.trim() ? (
        <MessageList
          messages={results}
          showRoom={!roomId}
          emptyTitle="No messages match"
          emptyDetail="Try fewer or different words."
        />
      ) : (
        <Empty
          title="Search your messages"
          detail="Words, names of files, anything you remember."
        />
      )}
    </Screen>
  );
}

/** Conversations put away: out of the list, still searchable, back with one tap. */
export function ArchivedScreen() {
  const navigate = useNavigate();
  const { archivedRooms, roomTitle, setArchived } = useChat();
  return (
    <Screen back title="Archived">
      {archivedRooms.length === 0 ? (
        <Empty title="No archived chats" />
      ) : (
        <ul className="divide-y divide-line border-y border-line bg-surface">
          {archivedRooms.map((room) => (
            <li key={room.id} className="flex items-center">
              <Row onClick={() => navigate(`/chats/${room.id}`)} className="flex-1">
                <RoomAvatar room={room} size={40} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                  {roomTitle(room)}
                </span>
              </Row>
              <button
                type="button"
                onClick={() => setArchived(room.id, false)}
                className="shrink-0 px-4 text-[14px] font-medium text-brand"
              >
                Unarchive
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
