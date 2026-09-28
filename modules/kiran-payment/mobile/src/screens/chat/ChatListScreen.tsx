import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, AtSign, Bookmark, BellOff, PenSquare, Search, WifiOff } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { Room, SharedMessage } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { Empty, Row, Screen } from '~/components/Screen';
import { RoomAvatar } from '~/components/RoomAvatar';
import { StorageWarning } from '~/components/StorageWarning';
import { MessageList } from '~/components/MessageList';
import { Sheet, SheetButton } from '~/components/Sheet';
import { relativeTime } from '~/lib/format';
import { previewText } from '~/lib/text';
import { tap } from '~/native/haptics';

/** The one line of a conversation that shows in the list. */
function preview(message: SharedMessage | undefined, senderName: string | null): string {
  if (!message) return 'No messages yet';
  if (message.deletedAt) return 'Message deleted';
  const body = message.attachment
    ? message.attachment.type.startsWith('image/')
      ? 'Photo'
      : message.attachment.name
    : message.content;
  return senderName ? `${senderName}: ${body}` : body;
}

export function ChatListScreen() {
  const navigate = useNavigate();
  const {
    visibleRooms,
    archivedRooms,
    roomTitle,
    lastMessage,
    unreadFor,
    userById,
    currentUserId,
    online,
    plainText,
    getDraft,
    searchMessages,
    notificationLevel,
    setNotificationLevel,
    setArchived,
    markRoomRead,
    savedMessages,
  } = useChat();
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<Room | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>();

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

  const found = useMemo(
    () => (query.trim().length >= 2 ? searchMessages(query) : []),
    [query, searchMessages],
  );

  const saved = savedMessages().length;

  return (
    <Screen
      title="Chats"
      action={
        <button
          type="button"
          onClick={() => {
            tap();
            navigate('/chats/new');
          }}
          aria-label="New chat"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-brand active:bg-slate-100"
        >
          <PenSquare className="h-5 w-5" />
        </button>
      }
    >
      <StorageWarning />
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
            placeholder="Search chats and messages"
            aria-label="Search conversations"
            className="h-9 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {!query && (saved > 0 || archivedRooms.length > 0) && (
        <div className="flex gap-2 bg-surface px-4 pb-2">
          {saved > 0 && (
            <button
              type="button"
              onClick={() => navigate('/saved')}
              className="flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[13px] font-medium text-ink"
            >
              <Bookmark className="h-3.5 w-3.5 text-brand" /> Saved ({saved})
            </button>
          )}
          {archivedRooms.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/chats/archived')}
              className="flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[13px] font-medium text-ink"
            >
              <Archive className="h-3.5 w-3.5 text-brand" /> Archived ({archivedRooms.length})
            </button>
          )}
        </div>
      )}

      {rooms.length === 0 && found.length === 0 ? (
        <Empty
          title={query ? 'No conversations match' : 'No conversations yet'}
          detail={query ? 'Try a different name or word.' : 'Tap the pencil to start one.'}
        />
      ) : (
        <ul className="divide-y divide-line border-t border-line bg-surface">
          {rooms.map((room: Room) => {
            const last = lastMessage(room.id);
            const unread = unreadFor(room.id);
            const draft = getDraft(room.id);
            const muted = notificationLevel(room.id) === 'none';
            const senderName =
              last && room.type !== 'direct' && last.senderId !== currentUserId
                ? userById(last.senderId).name.split(' ')[0]
                : null;

            return (
              <li
                key={room.id}
                onTouchStart={() => {
                  pressTimer.current = setTimeout(() => {
                    tap();
                    setMenuFor(room);
                  }, 450);
                }}
                onTouchEnd={() => clearTimeout(pressTimer.current)}
                onTouchMove={() => clearTimeout(pressTimer.current)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenuFor(room);
                }}
              >
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
                      {muted && (
                        <BellOff
                          className="h-3.5 w-3.5 shrink-0 text-slate-400"
                          aria-label="Muted"
                        />
                      )}
                      {last && (
                        <span className="shrink-0 text-[12px] text-slate-400">
                          {relativeTime(last.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      {draft?.text && unread.total === 0 ? (
                        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500">
                          <span className="font-medium text-destructive">Draft: </span>
                          {previewText(plainText(draft.text))}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[13px]',
                            unread.total > 0 ? 'text-ink-3' : 'text-slate-500',
                          )}
                        >
                          {previewText(plainText(preview(last, senderName)))}
                        </span>
                      )}
                      {unread.mentions > 0 && (
                        <span
                          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-destructive text-white"
                          aria-label="Mentions you"
                        >
                          <AtSign className="h-3 w-3" />
                        </span>
                      )}
                      {unread.total > 0 && (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-[18px] text-white',
                            muted ? 'bg-slate-400' : 'bg-brand',
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

      {found.length > 0 && (
        <>
          <h2 className="px-4 pb-1.5 pt-5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
            Messages
          </h2>
          <MessageList messages={found} emptyTitle="" />
        </>
      )}

      {menuFor && (
        <Sheet onClose={() => setMenuFor(null)} title={roomTitle(menuFor)}>
          {unreadFor(menuFor.id).total > 0 && (
            <SheetButton
              onClick={() => {
                markRoomRead(menuFor.id);
                setMenuFor(null);
              }}
            >
              Mark as read
            </SheetButton>
          )}
          <SheetButton
            onClick={() => {
              setNotificationLevel(
                menuFor.id,
                notificationLevel(menuFor.id) === 'none' ? 'all' : 'none',
              );
              setMenuFor(null);
            }}
          >
            {notificationLevel(menuFor.id) === 'none' ? 'Unmute' : 'Mute'}
          </SheetButton>
          <SheetButton
            onClick={() => {
              setArchived(menuFor.id, true);
              setMenuFor(null);
            }}
          >
            Archive
          </SheetButton>
          <SheetButton onClick={() => navigate(`/chats/${menuFor.id}/info`)}>
            {menuFor.type === 'direct' ? 'View profile' : 'Group info'}
          </SheetButton>
        </Sheet>
      )}
    </Screen>
  );
}
