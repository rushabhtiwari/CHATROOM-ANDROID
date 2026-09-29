import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { AgentMessage } from '@/components/chat/AgentMessage';
import { cn } from '@/lib/utils';
import { Empty } from '~/components/Screen';
import { useStickToBottom } from '~/lib/useStickToBottom';
import { useCloseOnBack } from '~/native/back-button';
import { selection, tap } from '~/native/haptics';

/**
 * The assistant, as a bottom sheet.
 *
 * `@agent` replies are private — they go to `aiMessages`, never into the room —
 * so they need a surface of their own. The console gives them a floating dock;
 * a phone has no room for a second column, so the dock becomes a sheet over
 * the conversation, and it opens by itself when a question is asked so the
 * answer is never somewhere the asker cannot see.
 *
 * Each exchange is rendered by the console's own `AgentMessage` in its narrow
 * `dock` variant: streaming shimmer, regenerate, share-to-room and copy all
 * behave exactly as they do on the desktop.
 */
export function AgentSheet({
  roomId,
  onClose,
  onSendToComposer,
}: {
  roomId: string;
  onClose: () => void;
  /** Hand a reply to the room's composer to edit before posting it. */
  onSendToComposer: (text: string) => void;
}) {
  const { aiConversation, askAgent, aiBudget, summarizeRoom } = useChat();
  const exchanges = aiConversation(roomId);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const { onScroll } = useStickToBottom({ scroller, content, resetKey: roomId });

  // Escape closes it on a hardware keyboard, which iPads have.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // And Android's back button, which every Android user reaches for first.
  useCloseOnBack(onClose);

  const ask = async () => {
    const question = prompt.trim();
    if (!question || busy) return;
    setBusy(true);
    setPrompt('');
    selection();
    try {
      await askAgent(roomId, question);
    } finally {
      setBusy(false);
    }
  };

  const remaining = Math.max(0, aiBudget.limit - aiBudget.used);

  return (
    <div
      className="absolute inset-0 z-30 flex items-end bg-ink/30"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Assistant"
        className="flex max-h-[85%] w-full animate-sheet-up flex-col rounded-t-2xl bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
          <Sparkles className="h-4 w-4 text-ai" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold text-ink">Assistant</h2>
            <p className="text-[12px] text-slate-500">
              Only you can see this · {remaining.toLocaleString('en-IN')} tokens left today
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              tap();
              onClose();
            }}
            aria-label="Close assistant"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div ref={scroller} onScroll={onScroll} className="scroll-y min-h-[160px] flex-1">
          <div ref={content} className="flex flex-col gap-4 px-3 py-3">
            {exchanges.length === 0 ? (
              <div>
                <Empty
                  title="Ask about this conversation"
                  detail="Summaries, decisions, who said what. Answers stay private until you share them."
                />
                <button
                  type="button"
                  onClick={() => {
                    tap();
                    void summarizeRoom(roomId);
                  }}
                  disabled={remaining === 0}
                  className="mx-auto -mt-8 flex h-10 items-center gap-2 rounded-full bg-ai/10 px-4 text-[14px] font-medium text-ai disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" /> Summarize this chat
                </button>
              </div>
            ) : (
              exchanges.map((ai) => (
                <AgentMessage
                  key={ai.id}
                  ai={ai}
                  variant="dock"
                  onSendToComposer={(text) => {
                    onSendToComposer(text);
                    onClose();
                  }}
                />
              ))
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-end gap-2 border-t border-line px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <textarea
            value={prompt}
            rows={1}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask a follow-up"
            aria-label="Ask the assistant"
            className="max-h-[96px] min-h-[40px] flex-1 resize-none rounded-2xl border border-line bg-slate-50 px-3 py-2 text-[16px] leading-snug text-ink outline-none focus:border-ai"
          />
          <button
            type="button"
            onClick={ask}
            disabled={!prompt.trim() || busy || remaining === 0}
            aria-label="Send to the assistant"
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ai text-white',
              (!prompt.trim() || busy || remaining === 0) && 'opacity-40',
            )}
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
