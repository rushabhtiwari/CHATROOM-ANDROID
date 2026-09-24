import { AlertCircle, Check, CheckCheck, Clock, MessagesSquare, Pin, Reply } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { SharedMessage } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { ClaimCard } from '@/components/chat/ClaimCard';
import { relativeTime } from '~/lib/format';
import { tap, warn } from '~/native/haptics';
import { previewText } from '~/lib/text';

/** The delivery tick, which on a phone is the only send feedback there is. */
function DeliveryMark({ message }: { message: SharedMessage }) {
  const { retryMessage, discardMessage } = useChat();

  if (message.delivery === 'failed') {
    return (
      <span className="flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        <button
          type="button"
          onClick={() => {
            warn();
            retryMessage(message.id);
          }}
          className="text-[11px] font-semibold text-destructive underline"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={() => discardMessage(message.id)}
          className="text-[11px] text-white/70 underline"
        >
          Discard
        </button>
      </span>
    );
  }

  if (message.delivery === 'sending') return <Clock className="h-3 w-3 opacity-70" />;
  if (message.delivery === 'sent') return <Check className="h-3.5 w-3.5 opacity-70" />;
  return (
    <CheckCheck
      className={cn('h-3.5 w-3.5', message.delivery === 'read' ? 'text-white' : 'opacity-70')}
    />
  );
}

export function MessageBubble({
  message,
  showSender,
  onReply,
  onReact,
  onOpenThread,
  /** Inside a thread the replies are the whole screen, so no thread footer. */
  inThread = false,
}: {
  message: SharedMessage;
  showSender: boolean;
  onReply: (message: SharedMessage) => void;
  onReact: (message: SharedMessage) => void;
  onOpenThread?: (message: SharedMessage) => void;
  inThread?: boolean;
}) {
  const {
    currentUserId,
    userById,
    users,
    userGroups,
    messageById,
    plainText,
    toggleReaction,
    threadCount,
  } = useChat();

  const mine = message.senderId === currentUserId;
  const sender = userById(message.senderId);
  const repliedTo = message.replyToId ? messageById(message.replyToId) : undefined;
  const replies = inThread ? 0 : threadCount(message.id);

  if (message.system) {
    return (
      <div className="px-4 py-1.5 text-center text-[12px] text-slate-500">{message.content}</div>
    );
  }

  // A long press is the phone's right-click. Touch devices give no contextmenu
  // event worth relying on, so the timer is explicit.
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  const startPress = () => {
    pressTimer = setTimeout(() => {
      tap();
      onReact(message);
    }, 450);
  };
  const endPress = () => clearTimeout(pressTimer);

  return (
    <div className={cn('flex px-3 py-0.5', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[78%]', mine && 'items-end')}>
        {showSender && !mine && (
          <p className="mb-0.5 pl-2 text-[12px] font-semibold" style={{ color: sender.color }}>
            {sender.name}
          </p>
        )}

        <div
          onTouchStart={startPress}
          onTouchEnd={endPress}
          onTouchMove={endPress}
          onDoubleClick={() => onReply(message)}
          className={cn(
            'relative rounded-2xl px-3 py-2 text-[15px] leading-snug',
            mine
              ? 'rounded-br-md bg-brand text-white'
              : 'rounded-bl-md border border-line bg-surface text-ink',
            message.delivery === 'failed' && 'opacity-90 ring-1 ring-destructive',
          )}
        >
          {message.pinnedBy && (
            <Pin className="absolute -top-1 right-2 h-3 w-3 rotate-45 text-strand-amber" />
          )}

          {repliedTo && (
            <button
              type="button"
              onClick={() => onReply(repliedTo)}
              className={cn(
                'mb-1.5 flex w-full items-start gap-1.5 rounded-lg border-l-2 px-2 py-1 text-left text-[12px]',
                mine ? 'border-white/60 bg-white/15' : 'border-brand bg-slate-100',
              )}
            >
              <Reply className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />
              <span className="line-clamp-2 opacity-90">
                {previewText(plainText(repliedTo.content)) || 'Attachment'}
              </span>
            </button>
          )}

          {message.attachment && (
            <div className="mb-1.5 overflow-hidden rounded-lg">
              {message.attachment.type.startsWith('image/') ? (
                <img
                  src={message.attachment.dataUrl}
                  alt={message.attachment.name}
                  className="max-h-72 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-2 text-[13px]',
                    mine ? 'bg-white/15' : 'bg-slate-100',
                  )}
                >
                  <span className="truncate">{message.attachment.name}</span>
                </div>
              )}
            </div>
          )}

          {/* A claim card is the console's component, unchanged. It re-reads the
              claim from the server on every render, so approving one here and
              approving it in the console cannot disagree. */}
          {message.claimId && (
            <div className="mb-1.5">
              <ClaimCard claimId={message.claimId} mine={mine} />
            </div>
          )}

          {message.deletedAt ? (
            <span className="italic opacity-70">Message deleted</span>
          ) : (
            message.content && (
              <MarkdownContent
                content={message.content}
                users={users}
                groups={userGroups}
                currentUserId={currentUserId}
                onPrimary={mine}
                className="break-words"
              />
            )
          )}

          <span
            className={cn(
              'mt-1 flex items-center justify-end gap-1 text-[11px]',
              mine ? 'text-white/80' : 'text-slate-400',
            )}
          >
            {message.editedAt && <span className="italic">edited</span>}
            {relativeTime(message.timestamp)}
            {mine && <DeliveryMark message={message} />}
          </span>
        </div>

        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1', mine && 'justify-end')}>
            {Object.entries(message.reactions).map(([emoji, userIds]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  tap();
                  toggleReaction(message.id, emoji);
                }}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px]',
                  userIds.includes(currentUserId)
                    ? 'border-brand bg-accent text-brand'
                    : 'border-line bg-surface text-slate-600',
                )}
              >
                <span>{emoji}</span>
                <span className="font-medium">{userIds.length}</span>
              </button>
            ))}
          </div>
        )}

        {replies > 0 && onOpenThread && (
          <button
            type="button"
            onClick={() => {
              tap();
              onOpenThread(message);
            }}
            className={cn(
              'mt-1 flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[12px] font-medium text-brand',
              mine && 'ml-auto',
            )}
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            {replies} {replies === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
    </div>
  );
}
