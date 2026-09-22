import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Paperclip, Send, Sparkles, X } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { MessageId, SharedMessage } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { pickPhoto } from '~/native/camera';
import { isNative } from '~/native/platform';
import { selection, tap } from '~/native/haptics';

/**
 * The composer.
 *
 * Deliberately smaller than the console's, which is a 32KB component carrying
 * slash commands, scheduling, a claim flow and an emoji grid. What survives
 * onto a phone is what a thumb reaches for: text, a photo, the assistant, and
 * whatever you are replying to.
 */
export function Composer({
  roomId,
  replyTo,
  onClearReply,
}: {
  roomId: string;
  replyTo: SharedMessage | null;
  onClearReply: () => void;
}) {
  const { sendMessage, sendAttachment, askAgent, canSend, currentUserId, activeRoom, plainText } =
    useChat();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const permission = canSend(activeRoom, currentUserId);
  const agentPrompt = text.trim().startsWith('@agent');

  const grow = () => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = 'auto';
    // Five lines, then it scrolls: past that the composer eats the conversation.
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;

    setBusy(true);
    try {
      if (agentPrompt) {
        await askAgent(roomId, body.replace(/^@agent\s*/, ''));
      } else {
        sendMessage(roomId, body, { replyToId: (replyTo?.id as MessageId) ?? null });
      }
      selection();
      setText('');
      onClearReply();
      if (textarea.current) textarea.current.style.height = 'auto';
    } finally {
      setBusy(false);
    }
  };

  const attach = async (source: 'camera' | 'library') => {
    setAttachOpen(false);
    const file = isNative ? await pickPhoto(source) : null;
    if (file) {
      await sendAttachment(roomId, file, undefined, {
        replyToId: (replyTo?.id as MessageId) ?? null,
      });
      onClearReply();
      return;
    }
    // No native picker — either the browser, or the user cancelled and the
    // plugin cannot tell us which. The file input is the honest fallback.
    if (!isNative) fileInput.current?.click();
  };

  if (!permission.allowed) {
    return (
      <div className="border-t border-line bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-[13px] text-slate-500">
        {permission.reason ?? 'You cannot send messages here.'}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-line bg-surface">
      {replyTo && (
        <div className="flex items-start gap-2 border-b border-line bg-slate-50 px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-brand pl-2">
            <p className="text-[12px] font-semibold text-brand">Replying</p>
            <p className="truncate text-[13px] text-slate-600">
              {plainText(replyTo.content) || 'Attachment'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            aria-label="Cancel reply"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {attachOpen && (
        <div className="flex gap-2 border-b border-line px-3 py-2">
          <button
            type="button"
            onClick={() => attach('camera')}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 text-[14px] font-medium text-ink active:bg-slate-200"
          >
            <Camera className="h-4 w-4" /> Camera
          </button>
          <button
            type="button"
            onClick={() => attach('library')}
            className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 text-[14px] font-medium text-ink active:bg-slate-200"
          >
            <ImageIcon className="h-4 w-4" /> Photos
          </button>
        </div>
      )}

      <div className="flex items-end gap-1.5 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            tap();
            setAttachOpen((open) => !open);
          }}
          aria-label="Attach"
          aria-expanded={attachOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <textarea
          ref={textarea}
          value={text}
          rows={1}
          onChange={(event) => {
            setText(event.target.value);
            grow();
          }}
          placeholder="Message"
          aria-label="Message"
          className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-2xl border border-line bg-slate-50 px-3 py-2 text-[16px] leading-snug text-ink outline-none focus:border-brand"
        />

        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || busy}
          aria-label={agentPrompt ? 'Ask the assistant' : 'Send'}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity',
            agentPrompt ? 'bg-ai' : 'bg-brand',
            (!text.trim() || busy) && 'opacity-40',
          )}
        >
          {agentPrompt ? <Sparkles className="h-5 w-5" /> : <Send className="h-[18px] w-[18px]" />}
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) await sendAttachment(roomId, file);
          event.target.value = '';
        }}
      />
    </div>
  );
}
