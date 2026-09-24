import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bell, BellOff, ChevronLeft } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { SharedMessage } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { MessageBubble } from '~/screens/chat/MessageBubble';
import { Composer } from '~/screens/chat/Composer';
import { Empty, Screen } from '~/components/Screen';
import { tap } from '~/native/haptics';

/**
 * A thread, as a pushed screen.
 *
 * The console shows threads in a panel beside the channel. There is no beside
 * on a phone, so a thread is a place you go and come back from — which also
 * makes the back gesture mean the obvious thing, and lets the composer here
 * post to the root rather than to the channel.
 */
export function ThreadScreen() {
  const { roomId, rootId } = useParams<{ roomId: string; rootId: string }>();
  const navigate = useNavigate();
  const {
    activeRoom,
    setActiveRoom,
    messageById,
    threadReplies,
    threadParticipants,
    isFollowingThread,
    toggleFollowThread,
  } = useChat();

  const [replyTo, setReplyTo] = useState<SharedMessage | null>(null);
  const [reacting, setReacting] = useState<SharedMessage | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (roomId && roomId !== activeRoom?.id) setActiveRoom(roomId);
  }, [roomId, activeRoom?.id, setActiveRoom]);

  const root = rootId ? messageById(rootId) : undefined;
  const replies = rootId ? threadReplies(rootId) : [];

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [replies.length]);

  if (!roomId || !rootId || !root) {
    return (
      <Screen back={() => navigate(roomId ? `/chats/${roomId}` : '/chats')} title="Thread">
        <Empty
          title="Thread not found"
          detail="The message this thread belongs to may have been deleted."
        />
      </Screen>
    );
  }

  const following = isFollowingThread(rootId);
  const participants = threadParticipants(rootId);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="shrink-0 border-b border-line bg-surface pt-safe-top">
        <div className="flex min-h-[52px] items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => {
              tap();
              navigate(`/chats/${roomId}`);
            }}
            aria-label="Back to conversation"
            className="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-brand active:bg-slate-100"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold leading-tight text-ink">Thread</h1>
            <p className="truncate text-[12px] text-slate-500">
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              {participants.length > 0 && ` · ${participants.length} people`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              tap();
              toggleFollowThread(rootId);
            }}
            aria-label={following ? 'Stop following this thread' : 'Follow this thread'}
            aria-pressed={following}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-lg',
              following ? 'text-brand' : 'text-slate-400',
            )}
          >
            {following ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <div ref={scroller} className="scroll-y min-h-0 flex-1 py-2">
        {/* The root reads as the subject of the screen, not as the first
            reply, so it sits above a rule rather than in the run. */}
        <MessageBubble
          message={root}
          showSender
          inThread
          onReply={setReplyTo}
          onReact={setReacting}
        />
        <div className="my-2 flex items-center gap-3 px-4">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            {replies.length === 0 ? 'No replies yet' : 'Replies'}
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {replies.map((message, index) => {
          const previous = replies[index - 1];
          const showSender =
            !previous ||
            previous.senderId !== message.senderId ||
            message.timestamp - previous.timestamp > 5 * 60_000;
          return (
            <MessageBubble
              key={message.id}
              message={message}
              showSender={showSender}
              inThread
              onReply={setReplyTo}
              onReact={setReacting}
            />
          );
        })}
      </div>

      <Composer
        roomId={roomId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        threadRootId={rootId}
      />

      {reacting && (
        <ReactionSheet message={reacting} onClose={() => setReacting(null)} onReply={setReplyTo} />
      )}
    </div>
  );
}

const QUICK_REACTIONS = ['👍', '✅', '🙏', '👀', '🎉', '❤️'];

/** The long-press sheet, shared by the conversation and the thread. */
export function ReactionSheet({
  message,
  onClose,
  onReply,
}: {
  message: SharedMessage;
  onClose: () => void;
  onReply: (message: SharedMessage) => void;
}) {
  const { toggleReaction, togglePin, isSaved, toggleSave } = useChat();
  const saved = isSaved(message.id);

  return (
    <div
      className="absolute inset-0 z-30 flex items-end bg-ink/30"
      onClick={onClose}
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
                toggleReaction(message.id, emoji);
                onClose();
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
            onReply(message);
            onClose();
          }}
          className="min-h-touch w-full border-t border-line text-[15px] font-medium text-brand active:bg-slate-100"
        >
          Reply
        </button>
        <button
          type="button"
          onClick={() => {
            togglePin(message.id);
            onClose();
          }}
          className="min-h-touch w-full border-t border-line text-[15px] font-medium text-ink active:bg-slate-100"
        >
          {message.pinnedBy ? 'Unpin' : 'Pin to conversation'}
        </button>
        <button
          type="button"
          onClick={() => {
            toggleSave(message.id);
            onClose();
          }}
          className="min-h-touch w-full border-t border-line text-[15px] font-medium text-ink active:bg-slate-100"
        >
          {saved ? 'Remove from saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
