import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  Camera,
  Clock,
  FileText,
  ReceiptText,
  Video,
  Image as ImageIcon,
  Paperclip,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '@/lib/chat-store';
import type { MessageId, SharedMessage } from '@/lib/chat-types';
import { activeMentionQuery, mentionCandidates, type MentionCandidate } from '@/lib/mentions';
import { cn } from '@/lib/utils';
import { pickPhoto } from '~/native/camera';
import { isNative } from '~/native/platform';
import { selection, tap } from '~/native/haptics';
import { previewText } from '~/lib/text';
import { Sheet, SheetButton } from '~/components/Sheet';
import { ClaimComposer } from '@/components/chat/ClaimComposer';
import { upcomingTime } from '~/lib/format';

/** `datetime-local` wants local time without a zone: "2026-09-28T14:30". */
function toLocalInput(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Tomorrow at 9, the time most people mean by "later". */
function defaultSendAt(now = Date.now()): number {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.getTime();
}

/**
 * The composer.
 *
 * Deliberately smaller than the console's, which is a 32KB component carrying
 * slash commands, an emoji grid and a claim flow. What survives onto a phone is
 * what a thumb reaches for: text, mentions, a photo, the assistant, scheduling,
 * and whatever you are replying to.
 */
export function Composer({
  roomId,
  replyTo,
  onClearReply,
  /** Set inside a thread: replies post to the root rather than the channel. */
  threadRootId = null,
  onAskAgent,
  seed,
}: {
  roomId: string;
  replyTo: SharedMessage | null;
  onClearReply: () => void;
  threadRootId?: MessageId | null;
  /** Called as an `@agent` question is sent, so the answer's sheet can open. */
  onAskAgent?: () => void;
  /**
   * Text to place in the composer — an assistant reply handed over to edit.
   * `nonce` makes handing over the same text twice still count as new.
   */
  seed?: { text: string; nonce: number };
}) {
  const navigate = useNavigate();
  const {
    sendMessage,
    sendAttachment,
    askAgent,
    canSend,
    currentUserId,
    activeRoom,
    users,
    userGroups,
    plainText,
    storageReady,
    getDraft,
    saveDraft,
    clearDraft,
    scheduleMessage,
    createMeeting,
  } = useChat();

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [mentions, setMentions] = useState<{ items: MentionCandidate[]; start: number } | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!seed) return;
    setText(seed.text);
    requestAnimationFrame(() => textarea.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  // Drafts: whatever you were typing is still there when you come back, per
  // conversation and per thread. Loaded once the saved state is read — before
  // that, there is nothing to load — and saved a moment after typing stops.
  const scope = `${roomId}:${threadRootId ?? ''}`;
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!storageReady || loadedFor.current === scope) return;
    loadedFor.current = scope;
    const draft = getDraft(roomId, threadRootId);
    if (draft?.text && !seed) setText(draft.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageReady, scope]);
  useEffect(() => {
    if (loadedFor.current !== scope) return;
    const timer = setTimeout(
      () => saveDraft(roomId, { text, replyToId: replyTo?.id ?? null, threadRootId }, threadRootId),
      400,
    );
    return () => clearTimeout(timer);
  }, [text, scope, roomId, threadRootId, replyTo, saveDraft]);

  const permission = canSend(activeRoom, currentUserId);
  const agentPrompt = text.trim().startsWith('@agent');

  // Size the box to its text whenever the text changes — however it changed.
  // Typing, a mention being inserted, an assistant reply handed over, a send
  // clearing it: resizing at each call site missed some of these; resizing on
  // the value itself cannot.
  useLayoutEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = 'auto';
    // Five lines, then it scrolls: past that the composer eats the conversation.
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
  }, [text]);

  /**
   * Re-evaluate the mention list on every keystroke and caret move.
   *
   * The console does this against a popup anchored to the caret. There is no
   * caret to anchor to on a phone — the keyboard owns the bottom half of the
   * screen — so the list sits directly above the composer instead, which is
   * the only place it can be both visible and reachable.
   */
  const syncMentions = () => {
    const node = textarea.current;
    if (!node) return;
    const value = node.value;
    // Read the caret from the DOM on the next frame rather than from the
    // change event. `selectionStart` on a React synthetic event is not
    // reliably up to date for programmatic and IME input — and an incorrect
    // caret makes the query silently empty, which looks like the feature
    // simply not working.
    const caret = node.selectionStart ?? value.length;
    const active = activeMentionQuery(value, caret);
    if (!active) {
      setMentions(null);
      return;
    }
    const items = mentionCandidates(
      active.query,
      users,
      userGroups,
      currentUserId,
      activeRoom.participantIds,
    );
    setMentions(items.length > 0 ? { items, start: active.start } : null);
  };

  const applyMention = (candidate: MentionCandidate) => {
    if (!mentions) return;
    const node = textarea.current;
    const caret = node?.selectionStart ?? text.length;
    const next = `${text.slice(0, mentions.start)}${candidate.token} ${text.slice(caret)}`;
    setText(next);
    setMentions(null);
    selection();

    // Put the caret after the inserted token rather than at the end, so a
    // mention typed mid-sentence does not send the writer back to the tail.
    const position = mentions.start + candidate.token.length + 1;
    requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(position, position);
    });
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;

    setBusy(true);
    try {
      if (agentPrompt) {
        // Open the sheet before awaiting, so the pending state is what the
        // asker sees rather than a composer that simply went quiet.
        onAskAgent?.();
        await askAgent(roomId, body.replace(/^@agent\s*/, ''));
      } else {
        sendMessage(roomId, body, {
          replyToId: (replyTo?.id as MessageId) ?? null,
          threadRootId,
        });
      }
      selection();
      setText('');
      clearDraft(roomId, threadRootId);
      setMentions(null);
      onClearReply();
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
        threadRootId,
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
      {mentions && (
        <ul className="max-h-[188px] overflow-y-auto border-b border-line" role="listbox">
          {mentions.items.slice(0, 6).map((candidate) => (
            <li key={candidate.key}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                // Taking focus would blur the textarea, and the blur handler
                // clears this list — the click would land on nothing.
                onMouseDown={(event) => event.preventDefault()}
                onTouchStart={(event) => event.preventDefault()}
                onClick={() => applyMention(candidate)}
                className="flex min-h-touch w-full items-center gap-2.5 px-3 py-2 text-left active:bg-slate-100"
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white',
                    candidate.kind === 'agent' && 'bg-ai',
                    candidate.kind === 'broadcast' && 'bg-strand-amber',
                    candidate.kind === 'group' && 'bg-slate-500',
                  )}
                  style={
                    candidate.kind === 'user'
                      ? { backgroundColor: candidate.user?.color ?? '#0A63C9' }
                      : undefined
                  }
                  aria-hidden
                >
                  {candidate.kind === 'agent' ? '✦' : candidate.label.replace('@', '')[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">
                    {candidate.label}
                  </span>
                  <span className="block truncate text-[12px] text-slate-500">
                    {candidate.detail}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {replyTo && (
        <div className="flex items-start gap-2 border-b border-line bg-slate-50 px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-brand pl-2">
            <p className="text-[12px] font-semibold text-brand">Replying</p>
            <p className="truncate text-[13px] text-slate-600">
              {previewText(plainText(replyTo.content)) || 'Attachment'}
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
        <div className="grid grid-cols-4 gap-2 border-b border-line px-3 py-3">
          {[
            { label: 'Camera', icon: Camera, run: () => attach('camera') },
            { label: 'Photos', icon: ImageIcon, run: () => attach('library') },
            {
              label: 'File',
              icon: FileText,
              run: () => {
                setAttachOpen(false);
                docInput.current?.click();
              },
            },
            {
              label: 'Meet now',
              icon: Video,
              run: async () => {
                setAttachOpen(false);
                await createMeeting(roomId);
              },
            },
            {
              label: 'Schedule',
              icon: CalendarClock,
              run: () => {
                setAttachOpen(false);
                navigate(`/chats/${roomId}/schedule`);
              },
            },
            ...(threadRootId
              ? []
              : [
                  {
                    label: 'Send later',
                    icon: Clock,
                    run: () => {
                      setAttachOpen(false);
                      setScheduling(toLocalInput(defaultSendAt()));
                    },
                  },
                ]),
            {
              label: 'Claim',
              icon: ReceiptText,
              run: () => {
                setAttachOpen(false);
                setClaiming(true);
              },
            },
          ].map(({ label, icon: Icon, run }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                tap();
                void run();
              }}
              className="flex flex-col items-center gap-1 rounded-xl py-2 text-[12px] font-medium text-ink active:bg-slate-100"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-brand">
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </button>
          ))}
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
            requestAnimationFrame(syncMentions);
          }}
          onKeyUp={syncMentions}
          onSelect={syncMentions}
          onBlur={() => setMentions(null)}
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
        ref={docInput}
        type="file"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            await sendAttachment(roomId, file, undefined, {
              replyToId: (replyTo?.id as MessageId) ?? null,
              threadRootId,
            });
            onClearReply();
          }
          event.target.value = '';
        }}
      />

      {claiming && (
        // The console's claim form, unchanged: photograph or pick the receipt,
        // let the assistant read it, correct the fields, file. The claim is
        // created by the finance API and posted here as a live card.
        <Sheet onClose={() => setClaiming(false)} label="Reimbursement claim">
          <div className="p-3">
            <ClaimComposer
              onClose={() => setClaiming(false)}
              onFiled={(claimId, reviewerName) => {
                setClaiming(false);
                sendMessage(roomId, `Filed a reimbursement claim for ${reviewerName} to review.`, {
                  claimId,
                  threadRootId,
                });
              }}
            />
          </div>
        </Sheet>
      )}

      {scheduling !== null && (
        <Sheet onClose={() => setScheduling(null)} title="Send later">
          <div className="space-y-3 px-4 pb-3 pt-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Message"
              aria-label="Scheduled message"
              rows={3}
              className="w-full resize-none rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-[16px] text-ink outline-none focus:border-brand"
            />
            <input
              type="datetime-local"
              value={scheduling}
              min={toLocalInput(Date.now())}
              onChange={(event) => setScheduling(event.target.value)}
              aria-label="Send at"
              className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-[16px] text-ink outline-none focus:border-brand"
            />
          </div>
          <SheetButton
            tone="brand"
            disabled={!text.trim() || !scheduling || new Date(scheduling).getTime() <= Date.now()}
            onClick={() => {
              const sendAt = new Date(scheduling!).getTime();
              scheduleMessage(roomId, text.trim(), sendAt);
              setText('');
              clearDraft(roomId, threadRootId);
              setScheduling(null);
              selection();
            }}
          >
            {scheduling && new Date(scheduling).getTime() > Date.now()
              ? `Schedule for ${upcomingTime(new Date(scheduling).getTime())}`
              : 'Pick a time in the future'}
          </SheetButton>
          <SheetButton onClick={() => setScheduling(null)}>Cancel</SheetButton>
        </Sheet>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) await sendAttachment(roomId, file, undefined, { threadRootId });
          event.target.value = '';
        }}
      />
    </div>
  );
}
