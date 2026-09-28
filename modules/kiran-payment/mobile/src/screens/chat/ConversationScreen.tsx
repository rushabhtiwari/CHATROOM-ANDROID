import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AtSign, CalendarClock, ChevronLeft, Pin, Sparkles } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { SharedMessage } from '@/lib/chat-types';
import { MessageBubble } from '~/screens/chat/MessageBubble';
import { Composer } from '~/screens/chat/Composer';
import { MessageActionsSheet } from '~/screens/chat/MessageActions';
import { AgentSheet } from '~/screens/chat/AgentSheet';
import { RoomAvatar } from '~/components/RoomAvatar';
import { Empty, Screen } from '~/components/Screen';
import { tap } from '~/native/haptics';
import { previewText } from '~/lib/text';
import { useStickToBottom } from '~/lib/useStickToBottom';
import { useRouteRoom } from '~/lib/useRouteRoom';

/**
 * Scroll to the message the store was asked to jump to, and flash it.
 *
 * The store widens the history window first, so the message is in the list
 * by the time this runs; the frame's wait is for it to be laid out.
 */
function useJumpTarget(ready: boolean, messageCount: number) {
  const { pendingJump, clearJump } = useChat();
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !pendingJump) return;
    const frame = requestAnimationFrame(() => {
      const target = document.querySelector(`[data-message-id="${CSS.escape(pendingJump)}"]`);
      if (!target) return;
      target.scrollIntoView({ block: 'center' });
      setHighlighted(pendingJump);
      clearJump();
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, pendingJump, clearJump, messageCount]);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(null), 1800);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return highlighted;
}

export function ConversationScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    rooms,
    activeRoom,
    roomTitle,
    channelMessages,
    hasMoreHistory,
    loadOlder,
    markRoomRead,
    pinnedMessages,
    scheduledMessages,
    plainText,
    currentUserId,
    userById,
    aiConversation,
    firstUnreadMentionId,
    jumpToMessage,
    markRoomNotificationsRead,
  } = useChat();

  const [replyTo, setReplyTo] = useState<SharedMessage | null>(null);
  const [acting, setActing] = useState<SharedMessage | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [pinIndex, setPinIndex] = useState(0);
  const [seed, setSeed] = useState<{ text: string; nonce: number }>();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  const ready = useRouteRoom(roomId);
  const highlighted = useJumpTarget(ready, channelMessages.length);

  // Keyed on readiness too: if the first render was the placeholder below, the
  // list's elements did not exist when the hook first ran.
  const { onScroll } = useStickToBottom({
    scroller,
    content,
    resetKey: ready ? roomId : undefined,
    firstItemKey: channelMessages[0]?.id,
    hasOlder: hasMoreHistory,
    loadOlder,
  });

  useEffect(() => {
    if (roomId) markRoomRead(roomId);
  }, [roomId, channelMessages.length, markRoomRead]);

  // "Summarize" on the info screen lands here with the assistant open.
  useEffect(() => {
    if (params.get('assistant') !== '1') return;
    setAgentOpen(true);
    setParams({}, { replace: true });
  }, [params, setParams]);

  if (!roomId || !rooms.some((room) => room.id === roomId)) {
    // The tab bar hides itself on a conversation route, so this state has to
    // carry its own way out or it is a dead end.
    return (
      <Screen back={() => navigate('/chats')} title="Conversation">
        <Empty title="Conversation not found" detail="It may have been archived or deleted." />
      </Screen>
    );
  }

  // For a frame or two after a cold start the store still points at the room
  // from last session. Its messages are not this room's; show nothing rather
  // than the wrong conversation under this one's URL.
  if (!ready) return <div className="h-full bg-canvas" aria-busy="true" />;

  const room = activeRoom;
  const pins = pinnedMessages(roomId);
  const pinned = pins[pinIndex % Math.max(1, pins.length)];
  const scheduled = scheduledMessages(roomId);
  const mentionId = firstUnreadMentionId(roomId);
  const isGroupish = room.type !== 'direct';
  const openInfo = (event: React.MouseEvent) => {
    event.stopPropagation();
    tap();
    navigate(`/chats/${roomId}/info`);
  };

  const subtitle =
    room.type === 'direct'
      ? (() => {
          const otherId = room.participantIds.find((id) => id !== currentUserId);
          const other = otherId ? userById(otherId) : undefined;
          return other?.online ? 'Online' : other?.role;
        })()
      : room.topic || `${room.participantIds.length} members · tap for info`;

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
          {/* The whole title area opens the info screen, as it does in every
              phone chat app; the avatar is the button a screen reader finds,
              and the title stays the screen's heading. */}
          <div onClick={openInfo} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
            <button type="button" onClick={openInfo} aria-label="Conversation info">
              <RoomAvatar room={room} size={34} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[16px] font-semibold leading-tight text-ink">
                {roomTitle(room)}
              </h1>
              {subtitle && <p className="truncate text-[12px] text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              tap();
              setAgentOpen(true);
            }}
            aria-label="Open the assistant"
            className="relative flex h-11 w-11 items-center justify-center rounded-lg text-ai active:bg-slate-100"
          >
            <Sparkles className="h-5 w-5" />
            {aiConversation(roomId).length > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-ai" aria-hidden />
            )}
          </button>
        </div>
      </header>

      {pinned && (
        <button
          type="button"
          onClick={() => {
            // Each tap shows the next pin, the way a stack of pins is read.
            jumpToMessage(roomId, pinned.id);
            setPinIndex((index) => index + 1);
          }}
          className="flex w-full items-center gap-2 border-b border-line bg-accent px-4 py-1.5 text-left"
        >
          <Pin className="h-3.5 w-3.5 shrink-0 text-brand" />
          {/* The banner is one line of plain text, so the markdown source has
              to be flattened rather than rendered — otherwise a pinned message
              reads as literal asterisks. */}
          <span className="min-w-0 flex-1 truncate text-[13px] text-brand">
            {previewText(plainText(pinned.content)) || 'Attachment'}
          </span>
          {pins.length > 1 && (
            <span className="shrink-0 text-[11px] font-medium text-brand/70">
              {(pinIndex % pins.length) + 1}/{pins.length}
            </span>
          )}
        </button>
      )}

      {scheduled.length > 0 && (
        <button
          type="button"
          onClick={() => navigate(`/chats/${roomId}/scheduled`)}
          className="flex w-full items-center gap-2 border-b border-line bg-surface px-4 py-1.5 text-left text-[13px] text-slate-600"
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-brand" />
          {scheduled.length} scheduled {scheduled.length === 1 ? 'message' : 'messages'}
        </button>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="scroll-y h-full">
          <div ref={content} className="py-2">
            {hasMoreHistory && (
              <p className="py-2 text-center text-[12px] text-slate-400">
                Loading earlier messages…
              </p>
            )}
            {channelMessages.length === 0 ? (
              <Empty title="No messages yet" detail="Say something to start this conversation." />
            ) : (
              channelMessages.map((message, index) => {
                const previous = channelMessages[index - 1];
                const showSender =
                  !previous ||
                  previous.system ||
                  previous.senderId !== message.senderId ||
                  message.timestamp - previous.timestamp > 5 * 60_000;
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    showSender={showSender}
                    showAvatar={isGroupish}
                    highlighted={highlighted === message.id}
                    onReply={setReplyTo}
                    onReact={setActing}
                    onOpenThread={(target) => navigate(`/chats/${roomId}/thread/${target.id}`)}
                  />
                );
              })
            )}
          </div>
        </div>

        {mentionId && (
          <button
            type="button"
            onClick={() => {
              tap();
              jumpToMessage(roomId, mentionId);
              markRoomNotificationsRead(roomId, 'mentions');
            }}
            aria-label="Jump to your unread mention"
            className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-lg"
          >
            <AtSign className="h-5 w-5" />
          </button>
        )}
      </div>

      <Composer
        roomId={roomId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onAskAgent={() => setAgentOpen(true)}
        seed={seed}
      />

      {acting && (
        <MessageActionsSheet
          message={acting}
          onClose={() => setActing(null)}
          onReply={setReplyTo}
        />
      )}

      {agentOpen && (
        <AgentSheet
          roomId={roomId}
          onClose={() => setAgentOpen(false)}
          onSendToComposer={(text) => setSeed({ text, nonce: Date.now() })}
        />
      )}
    </div>
  );
}
