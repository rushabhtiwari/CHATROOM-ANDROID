import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Pin } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { SharedMessage } from '@/lib/chat-types';
import { MessageBubble } from '~/screens/chat/MessageBubble';
import { Composer } from '~/screens/chat/Composer';
import { RoomAvatar } from '~/components/RoomAvatar';
import { Empty } from '~/components/Screen';
import { tap } from '~/native/haptics';

const QUICK_REACTIONS = ['👍', '✅', '🙏', '👀', '🎉', '❤️'];

export function ConversationScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    rooms,
    activeRoom,
    setActiveRoom,
    roomTitle,
    channelMessages,
    hasMoreHistory,
    loadOlder,
    markRoomRead,
    pinnedMessages,
    toggleReaction,
    currentUserId,
    userById,
  } = useChat();

  const [replyTo, setReplyTo] = useState<SharedMessage | null>(null);
  const [reacting, setReacting] = useState<SharedMessage | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  // The route is the authority for which room is open, so a tapped
  // notification or a back gesture cannot leave the store pointing elsewhere.
  useEffect(() => {
    if (roomId && roomId !== activeRoom?.id) setActiveRoom(roomId);
  }, [roomId, activeRoom?.id, setActiveRoom]);

  useEffect(() => {
    if (roomId) markRoomRead(roomId);
  }, [roomId, channelMessages.length, markRoomRead]);

  // Stick to the newest message, but only when the reader is already there —
  // yanking someone out of the history they are scrolled into is worse than
  // missing a message by one screen.
  useLayoutEffect(() => {
    if (atBottom.current) {
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    }
  }, [channelMessages.length]);

  if (!roomId || !rooms.some((room) => room.id === roomId)) {
    return <Empty title="Conversation not found" detail="It may have been archived or deleted." />;
  }

  const pinned = pinnedMessages(roomId)[0];
  const room = activeRoom;

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    if (node.scrollTop < 60 && hasMoreHistory) loadOlder();
  };

  const subtitle =
    room.type === 'direct'
      ? (() => {
          const otherId = room.participantIds.find((id) => id !== currentUserId);
          const other = otherId ? userById(otherId) : undefined;
          return other?.online ? 'Online' : other?.role;
        })()
      : `${room.participantIds.length} members`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="shrink-0 border-b border-line bg-surface pt-safe-top">
        <div className="flex min-h-[52px] items-center gap-2 px-2">
          <button
            type="button"
            onClick={() => {
              tap();
              navigate('/chats');
            }}
            aria-label="Back to chats"
            className="-ml-1 flex h-11 w-9 items-center justify-center rounded-lg text-brand active:bg-slate-100"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <RoomAvatar room={room} size={34} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[16px] font-semibold leading-tight text-ink">
              {roomTitle(room)}
            </h1>
            {subtitle && <p className="truncate text-[12px] text-slate-500">{subtitle}</p>}
          </div>
        </div>
      </header>

      {pinned && (
        <button
          type="button"
          onClick={() => setReplyTo(pinned)}
          className="flex w-full items-center gap-2 border-b border-line bg-accent px-4 py-1.5 text-left"
        >
          <Pin className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span className="truncate text-[13px] text-brand">{pinned.content || 'Attachment'}</span>
        </button>
      )}

      <div ref={scroller} onScroll={onScroll} className="scroll-y min-h-0 flex-1 py-2">
        {hasMoreHistory && (
          <p className="py-2 text-center text-[12px] text-slate-400">Loading earlier messages…</p>
        )}
        {channelMessages.length === 0 ? (
          <Empty title="No messages yet" detail="Say something to start this conversation." />
        ) : (
          channelMessages.map((message, index) => {
            const previous = channelMessages[index - 1];
            const showSender =
              !previous ||
              previous.senderId !== message.senderId ||
              message.timestamp - previous.timestamp > 5 * 60_000;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                showSender={showSender}
                onReply={setReplyTo}
                onReact={setReacting}
              />
            );
          })
        )}
      </div>

      <Composer roomId={roomId} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />

      {reacting && (
        <div
          className="absolute inset-0 z-30 flex items-end bg-ink/30"
          onClick={() => setReacting(null)}
          role="presentation"
        >
          <div
            className="w-full animate-sheet-up rounded-t-2xl bg-surface pb-safe-bottom"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-around px-4 py-4">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    tap();
                    toggleReaction(reacting.id, emoji);
                    setReacting(null);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-full text-2xl active:bg-slate-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setReplyTo(reacting);
                setReacting(null);
              }}
              className="min-h-touch w-full border-t border-line text-[15px] font-medium text-brand active:bg-slate-100"
            >
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
