/**
 * One private `@agent` exchange — the prompt echo, the streamed reply, and the
 * actions on it.
 *
 * This lives in its own file because two surfaces render it: the inline thread
 * (`MessageThread`) and the floating dock (`AgentDock`). They read the same
 * `aiMessages` state, so if each had its own copy of this markup the two views
 * of one conversation could drift — a pending shimmer in one and not the
 * other, an action available in one place only. There is one renderer, and
 * `variant` covers the only real difference: the thread aligns the card to the
 * right of a wide canvas, the dock fills a narrow column.
 */

import { Copy, Lock, RefreshCw, Send, Sparkles, TextCursorInput } from "lucide-react";
import { toast } from "sonner";
import { useChat } from "@/lib/chat-store";
import type { PrivateAIMessage } from "@/lib/chat-types";
import { formatTime } from "@/lib/time";
import { MarkdownContent } from "./MarkdownContent";
import { cn } from "@/lib/utils";

export function AgentMessage({
  ai,
  variant = "thread",
  onSendToComposer,
}: {
  ai: PrivateAIMessage;
  variant?: "thread" | "dock";
  /** Offered by the dock only: hand the reply to the composer to edit and send. */
  onSendToComposer?: (text: string) => void;
}) {
  const { regenerateAgent, shareAiToChat, users, userGroups, currentUserId, currentUser } =
    useChat();
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };
  const busy = ai.pending || ai.streaming;
  const dock = variant === "dock";

  return (
    <div
      className={cn("animate-msg-in", dock ? "w-full" : "self-end")}
      style={dock ? undefined : { maxWidth: "86%", marginLeft: "auto" }}
    >
      <div className={cn("mb-1.5 flex", dock ? "justify-start" : "justify-end")}>
        <span className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
          <span className="text-ai">@agent</span> {ai.prompt}
        </span>
      </div>
      <div className="ai-card rounded-xl p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className={cn("h-4 w-4 text-ai", busy && "animate-ai-glow")} />
          <span className="text-sm font-semibold">
            {ai.kind === "summary" ? "Catch-up summary" : "AI Agent"}
          </span>
          <span className="flex items-center gap-1 rounded-full border border-primary/15 bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-ai">
            <Lock className="h-2.5 w-2.5" /> Private to you
          </span>
          <span suppressHydrationWarning className="ml-auto text-[12px] text-muted-foreground">
            {formatTime(ai.timestamp, { timeZone: currentUser.timeZone })}
          </span>
        </div>

        {ai.pending && !ai.response ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Thinking
            <span className="flex gap-1">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-ai"
                  style={{ animationDelay: `${index * 0.15}s` }}
                />
              ))}
            </span>
          </p>
        ) : (
          <div className="text-sm leading-relaxed">
            <MarkdownContent
              content={ai.response}
              users={users}
              groups={userGroups}
              currentUserId={currentUserId}
            />
            {ai.streaming && (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-ai align-middle" />
            )}
          </div>
        )}

        {!busy && (
          <div className="mt-3 flex flex-wrap gap-2">
            <AgentAction icon={Copy} label="Copy" onClick={() => copy(ai.response)} />
            <AgentAction
              icon={RefreshCw}
              label="Regenerate"
              onClick={() => void regenerateAgent(ai.id)}
            />
            {!ai.error && (
              <AgentAction icon={Send} label="Share to Chat" onClick={() => shareAiToChat(ai.id)} />
            )}
            {!ai.error && onSendToComposer && (
              <AgentAction
                icon={TextCursorInput}
                label="Send to composer"
                onClick={() => onSendToComposer(ai.response)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-secondary"
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
