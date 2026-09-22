import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, WifiOff } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { Room, SharedMessage } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { Empty, Row, Screen } from '~/components/Screen';
import { RoomAvatar } from '~/components/RoomAvatar';
import { relativeTime } from '~/lib/format';

/** The one line of a conversation that shows in the list. */
function preview(message: SharedMessage | undefined, senderName: string | null): string {
  if (!message) return 'No messages yet';
  if (message.deletedAt) return 'Message deleted';
  const body = message.attachment
    ? (message.attachment.type.startsWith('image/') ? 'Photo' : message.attachment.name)
    : message.content;
  return senderName ? `${senderName}: ${body}` : body;
}

export function ChatListScreen() {
  const navigate = useNavigate();
  const {
    visibleRooms,
    roomTitle,
    lastMessage,
    unreadFor,
    userById,
    currentUserId,
    online,
    plainText,
  } = useChat();
  const [query, setQuery] = useState('');

  const rooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? visibleRooms.filter((room) => roomTitle(room).toLowerCase().includes(needle))
      : visibleRooms;

    // Most recent conversation first — the only ordering that makes sense on a
    // screen you open to find out what happened while you were away.
    return [...matching].sort(
      (a, b) => (lastMessage(b.id)?.timestamp ?? 0) - (lastMessage(a.id)?.timestamp ?? 0),
    );
  }, [visibleRooms, query, roomTitle, lastMessage]);

  return (
    <Screen title="Chats">
      {!online && (
        <div className="flex items-center gap-2 bg-strand-amber/10 px-4 py-2 text-[13px] text-strand-amber">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Offline. Messages you send will be queued.</span>
        </div>
      )}

      <div className="bg-surface px-4 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-9 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {rooms.length === 0 ? (
        <Empty
          title={query ? 'No conversations match' : 'No conversations yet'}
          detail={query ? 'Try a different name.' : undefined}
        />
      ) : (
        <ul className="divide-y divide-line border-t border-line bg-surface">
          {rooms.map((room: Room) => {
            const last = lastMessage(room.id);
            const unread = unreadFor(room.id);
            const senderName =
              last && room.type !== 'direct' && last.senderId !== currentUserId
                ? userById(last.senderId).name.split(' ')[0]
                : null;

            return (
              <li key={room.id}>
                <Row onClick={() => navigate(`/chats/${room.id}`)}>
                  <RoomAvatar room={room} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[15px] text-ink',
                          unread.total > 0 ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {roomTitle(room)}
                      </span>
                      {last && (
                        <span className="shrink-0 text-[12px] text-slate-400">
                          {relativeTime(last.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[13px]',
                          unread.total > 0 ? 'text-ink-3' : 'text-slate-500',
                        )}
                      >
                        {plainText(preview(last, senderName))}
                      </span>
                      {unread.total > 0 && (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-[18px] text-white',
                            unread.mentions > 0 ? 'bg-destructive' : 'bg-brand',
                          )}
                        >
                          {unread.total > 99 ? '99+' : unread.total}
                        </span>
                      )}
                    </div>
                  </div>
                </Row>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
