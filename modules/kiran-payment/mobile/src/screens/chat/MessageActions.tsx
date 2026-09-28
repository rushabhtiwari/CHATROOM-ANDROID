import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookmarkMinus,
  Copy,
  Forward,
  Info,
  MessagesSquare,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChat } from '@/lib/chat-store';
import type { SharedMessage } from '@/lib/chat-types';
import { ConfirmSheet, Sheet, SheetButton } from '~/components/Sheet';
import { RoomPickerSheet } from '~/components/Pickers';
import { PersonAvatar } from '~/components/Avatar';
import { tap } from '~/native/haptics';
import { relativeTime } from '~/lib/format';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏', '👀', '✅', '🔥', '😮', '😢', '💯', '👏'];

type Step = 'menu' | 'edit' | 'forward' | 'delete' | 'info';

/**
 * The long-press sheet, shared by the conversation and the thread: react,
 * and everything else you can do to a message.
 */
export function MessageActionsSheet({
  message,
  onClose,
  onReply,
  inThread = false,
}: {
  message: SharedMessage;
  onClose: () => void;
  onReply: (message: SharedMessage) => void;
  inThread?: boolean;
}) {
  const navigate = useNavigate();
  const {
    currentUserId,
    rooms,
    isAdmin,
    toggleReaction,
    togglePin,
    isSaved,
    toggleSave,
    editMessage,
    deleteMessage,
    forwardMessage,
    readersOf,
    plainText,
  } = useChat();
  const [step, setStep] = useState<Step>('menu');
  const [draft, setDraft] = useState(message.content);

  const mine = message.senderId === currentUserId;
  const room = rooms.find((candidate) => candidate.id === message.roomId);
  const deleted = Boolean(message.deletedAt);
  const settled = message.delivery !== 'sending' && message.delivery !== 'failed';
  const canDelete = !deleted && settled && (mine || (room ? isAdmin(room, currentUserId) : false));
  const canEdit = mine && !deleted && settled && !message.attachment;
  const saved = isSaved(message.id);

  if (step === 'edit') {
    return (
      <Sheet onClose={onClose} title="Edit message">
        <div className="px-4 pb-3 pt-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            aria-label="Message"
            className="w-full resize-none rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-[16px] text-ink outline-none focus:border-brand"
          />
        </div>
        <SheetButton
          tone="brand"
          disabled={!draft.trim() || draft.trim() === message.content.trim()}
          onClick={() => {
            editMessage(message.id, draft);
            onClose();
          }}
        >
          Save
        </SheetButton>
        <SheetButton onClick={onClose}>Cancel</SheetButton>
      </Sheet>
    );
  }

  if (step === 'forward') {
    return (
      <RoomPickerSheet
        title="Forward to"
        action="Forward"
        onPick={(roomIds) => {
          forwardMessage(message.id, roomIds);
          toast.success(
            roomIds.length === 1 ? 'Forwarded' : `Forwarded to ${roomIds.length} chats`,
          );
        }}
        onClose={onClose}
      />
    );
  }

  if (step === 'delete') {
    return (
      <ConfirmSheet
        title="Delete this message?"
        detail="It is removed for everyone in the conversation."
        confirm="Delete for everyone"
        onConfirm={() => deleteMessage(message.id)}
        onClose={onClose}
      />
    );
  }

  if (step === 'info') {
    const readers = readersOf(message);
    return (
      <Sheet onClose={onClose} title="Message info">
        <p className="px-4 pb-2 text-center text-[12px] text-slate-500">
          Sent {relativeTime(message.timestamp)}
          {message.editedAt ? ` · edited ${relativeTime(message.editedAt)}` : ''}
        </p>
        <h3 className="px-4 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          Seen by {readers.length}
        </h3>
        {readers.length === 0 ? (
          <p className="px-4 pb-4 text-[14px] text-slate-500">Nobody has read it yet.</p>
        ) : (
          <ul className="pb-2">
            {readers.map((reader) => (
              <li key={reader.id} className="flex items-center gap-3 px-4 py-2">
                <PersonAvatar user={reader} size={32} />
                <span className="text-[15px] text-ink">{reader.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    );
  }

  const react = (emoji: string) => {
    tap();
    toggleReaction(message.id, emoji);
    onClose();
  };

  return (
    <Sheet onClose={onClose} label="Message actions">
      {!deleted && (
        <div className="flex gap-1 overflow-x-auto px-3 py-3">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => react(emoji)}
              aria-label={`React ${emoji}`}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl active:bg-slate-100"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {!deleted && (
        <SheetButton
          icon={<Reply className="h-5 w-5" />}
          onClick={() => {
            onReply(message);
            onClose();
          }}
        >
          Reply
        </SheetButton>
      )}
      {!deleted && !inThread && !message.threadRootId && (
        <SheetButton
          icon={<MessagesSquare className="h-5 w-5" />}
          onClick={() => {
            onClose();
            navigate(`/chats/${message.roomId}/thread/${message.id}`);
          }}
        >
          Reply in thread
        </SheetButton>
      )}
      {!deleted && message.content && (
        <SheetButton
          icon={<Copy className="h-5 w-5" />}
          onClick={async () => {
            onClose();
            try {
              await navigator.clipboard.writeText(plainText(message.content));
              toast.success('Copied');
            } catch {
              toast.error('Could not copy');
            }
          }}
        >
          Copy text
        </SheetButton>
      )}
      {!deleted && settled && (
        <SheetButton icon={<Forward className="h-5 w-5" />} onClick={() => setStep('forward')}>
          Forward
        </SheetButton>
      )}
      {!deleted && settled && (
        <SheetButton
          icon={message.pinnedBy ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
          onClick={() => {
            togglePin(message.id);
            onClose();
          }}
        >
          {message.pinnedBy ? 'Unpin' : 'Pin to conversation'}
        </SheetButton>
      )}
      {!deleted && (
        <SheetButton
          icon={saved ? <BookmarkMinus className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          onClick={() => {
            toggleSave(message.id);
            onClose();
          }}
        >
          {saved ? 'Remove from saved' : 'Save'}
        </SheetButton>
      )}
      {canEdit && (
        <SheetButton icon={<Pencil className="h-5 w-5" />} onClick={() => setStep('edit')}>
          Edit
        </SheetButton>
      )}
      {mine && settled && (
        <SheetButton icon={<Info className="h-5 w-5" />} onClick={() => setStep('info')}>
          Info
        </SheetButton>
      )}
      {canDelete && (
        <SheetButton
          tone="danger"
          icon={<Trash2 className="h-5 w-5" />}
          onClick={() => setStep('delete')}
        >
          Delete
        </SheetButton>
      )}
    </Sheet>
  );
}
