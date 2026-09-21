/**
 * Floating agent bubble and its docked window.
 *
 * This is a second entry point to the assistant, not a second assistant: it
 * calls the same `askAgent` the composer's `@agent` prefix calls, renders the
 * same `AgentMessage`, and reads the same per-room `aiConversation`. A question
 * asked here shows up inline in the thread and vice versa, because there is
 * only ever one conversation behind both views.
 *
 * The one piece of composer behaviour it deliberately mirrors rather than
 * shares is meeting-intent routing: "schedule a meeting" starts a scheduling
 * conversation in the dock instead of round-tripping the model. It asks one
 * question at a time, in place, rather than throwing a form over the chat.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Lock, Send, Sparkles, X } from "lucide-react";
import { useChat } from "@/lib/chat-store";
import { useAgentDock } from "@/lib/agent-dock";
import { isMeetingScheduleIntent } from "@/lib/meeting-intent";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PrivateAIMessage, RoomId } from "@/lib/chat-types";
import { AgentMessage } from "./AgentMessage";
import { MeetingAgentFlow } from "./MeetingAgentFlow";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STARTERS = [
  "Schedule a meeting",
  "Summarise this chat",
  "Draft a reply",
  "List action items",
] as const;

export function AgentDock({
  /** Set while a mobile sheet owns the screen; the bubble would sit on top of it. */
  suppressed = false,
}: {
  suppressed?: boolean;
}) {
  const { activeRoom, roomTitle, aiConversation, aiMessages, askAgent, currentUserId } = useChat();
  const {
    open,
    openDock,
    closeDock,
    toggleDock,
    size,
    setSize,
    prefill,
    clearPrefill,
    sendToComposer,
    meetingPrompt,
    startMeeting,
    clearMeeting,
  } = useAgentDock();
  const isMobile = useIsMobile();

  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const [switchedFrom, setSwitchedFrom] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = aiConversation(activeRoom.id);

  /* ------------------------------- unread ------------------------------- */

  /**
   * Replies that finished while the window was shut. Ids are tracked rather
   * than a count so a re-render, a room switch or a reload cannot double-count
   * the same answer.
   */
  const settledSeen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const settled = aiMessages.filter(
      (message) => message.ownerUserId === currentUserId && !message.pending && !message.streaming,
    );

    // First pass seeds the baseline: history restored from storage is not news.
    if (settledSeen.current === null) {
      settledSeen.current = new Set(settled.map((message) => message.id));
      return;
    }

    const seen = settledSeen.current;
    let arrived = 0;
    for (const message of settled) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      arrived += 1;
    }
    if (arrived > 0 && !open) setUnread((current) => current + arrived);
  }, [aiMessages, currentUserId, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  /* ---------------------------- room switching --------------------------- */

  const previousRoom = useRef<RoomId | null>(null);
  useEffect(() => {
    if (!open) {
      previousRoom.current = activeRoom.id;
      setSwitchedFrom(null);
      return;
    }
    if (previousRoom.current && previousRoom.current !== activeRoom.id) {
      setSwitchedFrom(roomTitle(activeRoom));
    }
    previousRoom.current = activeRoom.id;
  }, [activeRoom, open, roomTitle]);

  /* ------------------------------- prefill ------------------------------- */

  useEffect(() => {
    if (prefill === null) return;
    setText(prefill);
    clearPrefill();
    // The dock may still be mounting when the selection hands text over.
    requestAnimationFrame(() => {
      const element = inputRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    });
  }, [prefill, clearPrefill]);

  /* ------------------------------ scrolling ------------------------------ */

  const lastKey = conversation.at(-1);
  useLayoutEffect(() => {
    if (!open) return;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [open, activeRoom.id, lastKey?.id, lastKey?.response, lastKey?.pending]);

  /* ------------------------------- sending ------------------------------- */

  const ask = useCallback(
    (raw: string) => {
      // Typing "@agent …" here out of habit should not reach the model twice.
      const prompt = raw
        .trim()
        .replace(/^@agent\b/i, "")
        .trim();
      if (!prompt) return;
      setText("");
      if (isMeetingScheduleIntent(prompt)) {
        startMeeting(prompt);
        return;
      }
      void askAgent(activeRoom.id, prompt);
    },
    [activeRoom.id, askAgent, startMeeting],
  );

  /* ------------------------------ shortcuts ------------------------------ */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        toggleDock();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleDock]);

  /* ------------------------------- resizing ------------------------------ */

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const originX = event.clientX;
      const originY = event.clientY;
      const { width, height } = size;
      // Anchored bottom-right, so dragging the top-left grip up and left grows it.
      const onMove = (move: PointerEvent) => {
        setSize({
          width: width - (move.clientX - originX),
          height: height - (move.clientY - originY),
        });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [size, setSize],
  );

  /* -------------------------------- render ------------------------------- */

  const dockStyle = isMobile
    ? undefined
    : {
        width: size.width,
        height: Math.min(
          size.height,
          typeof window === "undefined" ? size.height : window.innerHeight - 96,
        ),
      };

  return (
    <>
      {!open && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => openDock()}
                aria-label="Ask the AI assistant"
                className={cn(
                  "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-surface shadow-[var(--shadow-float)] transition-transform hover:scale-105 active:scale-95",
                  // Above the mobile composer's safe area.
                  "max-md:bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]",
                  suppressed && "max-md:hidden",
                )}
              >
                <span className="ai-card absolute inset-0 rounded-full opacity-70" aria-hidden />
                <Sparkles className="relative h-6 w-6 animate-ai-glow text-ai" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ai px-1 text-[12px] font-semibold text-ai-foreground">
                    {unread}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Ask the AI assistant</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {open && (
        <section
          data-agent-dock=""
          aria-label="AI assistant"
          style={dockStyle}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            closeDock();
          }}
          className={cn(
            "glass animate-msg-in fixed z-50 flex flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-float)]",
            "max-md:inset-0 max-md:rounded-none md:bottom-5 md:right-5",
          )}
        >
          {/* Resize grip, desktop only — the mobile sheet is full-screen. */}
          <button
            type="button"
            aria-label="Resize assistant"
            onPointerDown={startResize}
            className="absolute left-0 top-0 z-10 hidden h-4 w-4 cursor-nwse-resize md:block"
          />

          <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-2.5">
            <span className="ai-card flex h-8 w-8 items-center justify-center rounded-full">
              <Sparkles className="h-4 w-4 text-ai" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">AI Assistant</p>
              <p className="truncate text-[12px] text-muted-foreground">
                Private · {roomTitle(activeRoom)}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-primary/15 bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-ai">
              <Lock className="h-2.5 w-2.5" /> Private to you
            </span>
            <button
              type="button"
              onClick={() => closeDock()}
              aria-label="Minimize assistant"
              title="Minimize"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setText("");
                closeDock(true);
              }}
              aria-label="Close assistant"
              title="Close"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            {conversation.length === 0 && !meetingPrompt ? (
              <EmptyState onPick={ask} />
            ) : (
              conversation.map((ai: PrivateAIMessage) => (
                <AgentMessage
                  key={ai.id}
                  ai={ai}
                  variant="dock"
                  onSendToComposer={(value) => {
                    sendToComposer(activeRoom.id, value);
                    closeDock();
                  }}
                />
              ))
            )}

            {meetingPrompt !== null && (
              <MeetingAgentFlow
                key={meetingPrompt}
                prompt={meetingPrompt}
                onCancel={clearMeeting}
                onScheduled={() => {
                  // The flow keeps rendering its confirmation card; clearing
                  // the prompt here would replace it with the empty state.
                }}
              />
            )}

            {switchedFrom && (
              <div className="flex items-center gap-2 pt-1" role="separator">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[12px] font-medium text-muted-foreground">
                  Switched to {switchedFrom}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-border bg-surface-2/60 p-2.5">
            <div className={cn("flex items-end gap-2", meetingPrompt !== null && "hidden")}>
              <textarea
                ref={inputRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  ask(text);
                }}
                rows={1}
                placeholder={`Ask about ${roomTitle(activeRoom)}…`}
                aria-label="Message the AI assistant"
                className="max-h-28 min-h-9 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
              />
              <button
                type="button"
                onClick={() => ask(text)}
                disabled={!text.trim()}
                aria-label="Send to the AI assistant"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {meetingPrompt !== null ? (
              <button
                type="button"
                onClick={clearMeeting}
                className="w-full rounded-lg border border-border py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Back to the assistant
              </button>
            ) : (
              <p className="mt-1.5 px-0.5 text-[12px] text-muted-foreground">
                Replies stay private to you until you share them. Enter sends, Shift+Enter for a
                new line.
              </p>
            )}
          </footer>
        </section>
      )}

    </>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <span className="ai-card mb-3 flex h-12 w-12 items-center justify-center rounded-full">
        <Sparkles className="h-5 w-5 animate-ai-glow text-ai" />
      </span>
      <p className="text-sm font-semibold">Ask me anything about this conversation</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        I read the recent messages in this room. Answers are private to you.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => onPick(starter)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary"
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}
