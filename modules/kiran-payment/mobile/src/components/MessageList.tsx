import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '@/lib/chat-store';
import type { SharedMessage } from '@/lib/chat-types';
import { Empty } from '~/components/Screen';
import { PersonAvatar } from '~/components/Avatar';
import { relativeTime } from '~/lib/format';
import { previewText } from '~/lib/text';
import { tap } from '~/native/haptics';

/**
 * Open a message where it lives: in its thread if it is a reply, otherwise in
 * its conversation, scrolled to it and flashed.
 */
export function useOpenMessage() {
  const navigate = useNavigate();
  const { jumpToMessage } = useChat();
  return useCallback(
    (message: SharedMessage) => {
      if (message.threadRootId) {
        navigate(`/chats/${message.roomId}/thread/${message.threadRootId}`);
        return;
      }
      jumpToMessage(message.roomId, message.id);
      navigate(`/chats/${message.roomId}`);
    },
    [jumpToMessage, navigate],
  );
}

/** The one line of a message that shows in a list. */
export function useMessageSummary() {
  const { plainText } = useChat();
  return useCallback(
    (message: SharedMessage) => {
      if (message.deletedAt) return 'Message deleted';
      const text = previewText(plainText(message.content));
      if (text) return text;
      if (message.attachment) {
        return message.attachment.type.startsWith('image/') ? 'Photo' : message.attachment.name;
      }
      return 'Message';
    },
    [plainText],
  );
}

/** Messages from anywhere, each showing who, where and when. */
export function MessageList({
  messages,
  emptyTitle,
  emptyDetail,
  showRoom = true,
  trailing,
  onOpen,
}: {
  messages: SharedMessage[];
  emptyTitle: string;
  emptyDetail?: string;
  showRoom?: boolean;
  /** Extra controls on a row, e.g. "Send now" on a scheduled message. */
  trailing?: (message: SharedMessage) => React.ReactNode;
  /** Defaults to opening the message in its conversation. */
  onOpen?: (message: SharedMessage) => void;
}) {
  const { userById, rooms, roomTitle } = useChat();
  const open = useOpenMessage();
  const summary = useMessageSummary();

  if (messages.length === 0) return <Empty title={emptyTitle} detail={emptyDetail} />;

  return (
    <ul className="divide-y divide-line border-y border-line bg-surface">
      {messages.map((message) => {
        const sender = userById(message.senderId);
        const room = rooms.find((candidate) => candidate.id === message.roomId);
        return (
          <li key={message.id} className="flex items-start">
            <button
              type="button"
              onClick={() => {
                tap();
                (onOpen ?? open)(message);
              }}
              className="flex min-h-touch min-w-0 flex-1 items-start gap-3 px-4 py-2.5 text-left active:bg-slate-100"
            >
              <PersonAvatar user={sender} size={34} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                    {sender.name}
                    {showRoom && room && (
                      <span className="font-normal text-slate-500"> · {roomTitle(room)}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[12px] text-slate-400">
                    {relativeTime(message.scheduledFor ?? message.timestamp)}
                  </span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] text-slate-600">
                  {summary(message)}
                </span>
              </span>
            </button>
            {trailing && <div className="shrink-0 py-2 pr-3">{trailing(message)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
