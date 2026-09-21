import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, AtSign, ChevronUp, Sparkles } from "lucide-react";
import { useChat } from "@/lib/chat-store";
import { useAgentDock } from "@/lib/agent-dock";
import type { PrivateAIMessage, SharedMessage } from "@/lib/chat-types";
import { dayKey, formatDayLabel } from "@/lib/time";
import { useI18n } from "@/lib/i18n";
import { MessageItem } from "./MessageItem";
import { AgentMessage } from "./AgentMessage";
import { cn } from "@/lib/utils";
import { useChatWallpaper } from "@/lib/chat-wallpaper";

type Row =
  | { kind: "day"; key: string; timestamp: number }
  | { kind: "unread"; key: string; count: number }
  | { kind: "mention-divider"; key: string }
  | { kind: "msg"; key: string; data: SharedMessage }
  | { kind: "ai"; key: string; data: PrivateAIMessage };

export function MessageThread({
  onReply,
  onOpenThread,
  onForward,
}: {
  onReply: (message: SharedMessage) => void;
  onOpenThread: (rootId: string) => void;
  onForward: (message: SharedMessage) => void;
}) {
  const {
    activeRoom,
    channelMessages,
    hasMoreHistory,
    loadOlder,
    aiConversation,
    currentUser,
    unreadFor,
    markRoomRead,
    pendingJump,
    clearJump,
    firstUnreadMentionId,
  } = useChat();
  const { t } = useI18n();
  const { openDock } = useAgentDock();
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledJumpRef = useRef<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  /** Frozen at mount/room-change so the divider doesn't jump as you read. */
  const [unreadAnchor, setUnreadAnchor] = useState<{ id: string; count: number } | null>(null);
  /** Same treatment for the "new mentions" marker. */
  const [mentionAnchor, setMentionAnchor] = useState<string | null>(null);
  /** Live text selection inside the log, and where to float "Ask AI" over it. */
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);

  const timeZone = currentUser.timeZone;
  const aiMessages = aiConversation(activeRoom.id);
  const { wallpaper } = useChatWallpaper(currentUser.id, activeRoom.id);

  useEffect(() => {
    const summary = unreadFor(activeRoom.id);
    setUnreadAnchor(
      summary.firstUnreadId ? { id: summary.firstUnreadId, count: summary.total } : null,
    );
    setMentionAnchor(firstUnreadMentionId(activeRoom.id));
    // Deliberately keyed on the room only: recomputing on every message change
    // would move the divider while the user is still reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom.id]);

  const rows = useMemo(() => {
    const merged = [
      ...channelMessages.map((data) => ({ sort: data.timestamp, kind: "msg" as const, data })),
      ...aiMessages.map((data) => ({ sort: data.timestamp, kind: "ai" as const, data })),
    ].sort((a, b) => a.sort - b.sort);

    const out: Row[] = [];
    let lastDay = "";
    for (const entry of merged) {
      const key = dayKey(entry.sort, timeZone);
      if (key !== lastDay) {
        lastDay = key;
        out.push({ kind: "day", key: `day-${key}`, timestamp: entry.sort });
      }
      if (
        entry.kind === "msg" &&
        unreadAnchor &&
        entry.data.id === unreadAnchor.id &&
        unreadAnchor.count > 0
      ) {
        out.push({ kind: "unread", key: "unread-divider", count: unreadAnchor.count });
      }
      if (entry.kind === "msg" && mentionAnchor && entry.data.id === mentionAnchor) {
        out.push({ kind: "mention-divider", key: "mention-divider" });
      }
      out.push(
        entry.kind === "msg"
          ? { kind: "msg", key: entry.data.id, data: entry.data }
          : { kind: "ai", key: entry.data.id, data: entry.data },
      );
    }
    return out;
  }, [channelMessages, aiMessages, timeZone, unreadAnchor, mentionAnchor]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    // Rough average bubble height; every row is measured for real after mount.
    estimateSize: () => 96,
    overscan: 8,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);

  // Stick to the newest message unless the user has scrolled up to read history.
  const lastRowKey = rows[rows.length - 1]?.key;
  useLayoutEffect(() => {
    if (atBottom) scrollToBottom("auto");
  }, [lastRowKey, atBottom, scrollToBottom]);

  useEffect(() => {
    scrollToBottom("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom.id]);

  /**
   * Offers the selected text to the assistant. Read on pointer/key release
   * rather than from `selectionchange`, which fires continuously mid-drag and
   * would make the button chase the cursor.
   */
  const captureSelection = useCallback(() => {
    const active = window.getSelection();
    const container = scrollRef.current;
    if (!active || !container || active.isCollapsed || active.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const range = active.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const text = active.toString().trim();
    if (text.length < 2) {
      setSelection(null);
      return;
    }
    // Guarded because a throw here would come out of a mouseup handler and
    // take the whole log down with it; jsdom, for one, has no Range geometry.
    const rect =
      typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : null;
    setSelection({
      text,
      x: rect ? rect.left + rect.width / 2 : 0,
      y: rect ? rect.top : 0,
    });
  }, []);

  const onScroll = useCallback(() => {
    setSelection(null);
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    const bottom = distance < 80;
    setAtBottom(bottom);
    if (bottom) markRoomRead(activeRoom.id);
  }, [activeRoom.id, markRoomRead]);

  // Permalink / search jump: scroll the target into view and flash it.
  useEffect(() => {
    if (!pendingJump) {
      handledJumpRef.current = null;
      return;
    }
    // Scrolling updates local state and can cause the virtualizer object to be
    // refreshed. Handle a jump only once so those renders do not keep
    // recentering the message and fighting the user's wheel/touch scrolling.
    if (handledJumpRef.current === pendingJump) return;
    const index = rows.findIndex((row) => row.kind === "msg" && row.data.id === pendingJump);
    if (index === -1) return;
    handledJumpRef.current = pendingJump;

    // Let the virtualizer materialise the row. A second page-level
    // scrollIntoView used to compete with this scroll and could also move an
    // outer layout container, making pinned-message jumps visibly oscillate.
    virtualizer.scrollToIndex(index, { align: "center" });
    const settle = window.setTimeout(() => {
      const scroller = scrollRef.current;
      const target = document.getElementById(`msg-${pendingJump}`);
      if (!scroller || !target) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset =
        targetRect.top + targetRect.height / 2 - (scrollerRect.top + scrollerRect.height / 2);
      if (Math.abs(offset) > 1) {
        scroller.scrollTo({ top: scroller.scrollTop + offset, behavior: "auto" });
      }
    }, 80);
    const clear = setTimeout(() => clearJump(), 2600);
    return () => {
      clearTimeout(settle);
      clearTimeout(clear);
    };
  }, [pendingJump, rows, virtualizer, clearJump]);

  const items = virtualizer.getVirtualItems();

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        role="log"
        aria-live="polite"
        aria-label={`Messages in ${activeRoom.name ?? "conversation"}`}
        className="chat-canvas h-full overscroll-contain overflow-y-auto bg-background bg-cover bg-center bg-no-repeat px-4 py-6 md:px-8"
        style={
          wallpaper
            ? {
                backgroundImage: `linear-gradient(rgb(5 12 24 / 42%), rgb(5 12 24 / 42%)), url(${JSON.stringify(wallpaper)})`,
              }
            : undefined
        }
      >
        <div className="mx-auto max-w-4xl">
          {hasMoreHistory && (
            <div className="mb-4 flex justify-center">
              <button
                onClick={loadOlder}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-medium shadow-sm transition-colors hover:bg-secondary"
              >
                <ChevronUp className="h-3.5 w-3.5" /> Load earlier messages
              </button>
            </div>
          )}

          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            <div
              className="absolute left-0 top-0 flex w-full flex-col gap-4"
              style={{ transform: `translateY(${items[0]?.start ?? 0}px)` }}
            >
              {items.map((item) => {
                const row = rows[item.index];
                if (!row) return null;
                return (
                  <div
                    key={item.key}
                    data-index={item.index}
                    ref={virtualizer.measureElement}
                    className="flex flex-col"
                  >
                    {row.kind === "day" && (
                      <div className="flex justify-center py-1">
                        <span className="rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted-foreground shadow-sm">
                          {formatDayLabel(row.timestamp, { timeZone })}
                        </span>
                      </div>
                    )}
                    {row.kind === "unread" && (
                      <div className="flex items-center gap-2 py-1" role="separator">
                        <span className="h-px flex-1 bg-destructive/40" />
                        <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[12px] font-semibold text-destructive">
                          {t("unread.divider", { count: row.count })}
                        </span>
                        <span className="h-px flex-1 bg-destructive/40" />
                      </div>
                    )}
                    {row.kind === "mention-divider" && (
                      <div className="flex items-center gap-2 py-1" role="separator">
                        <span className="h-px flex-1 bg-ai/40" />
                        <span className="flex items-center gap-1 rounded-full bg-ai/10 px-2.5 py-0.5 text-[12px] font-semibold text-ai">
                          <AtSign className="h-2.5 w-2.5" /> New mentions since you were away
                        </span>
                        <span className="h-px flex-1 bg-ai/40" />
                      </div>
                    )}
                    {row.kind === "msg" && (
                      <MessageItem
                        message={row.data}
                        onReply={onReply}
                        onOpenThread={onOpenThread}
                        onForward={onForward}
                        highlighted={pendingJump === row.data.id}
                      />
                    )}
                    {row.kind === "ai" && <AgentMessage ai={row.data} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selection && (
        <button
          type="button"
          style={{ left: selection.x, top: selection.y - 8 }}
          onClick={() => {
            openDock(`About this: "${selection.text}"

`);
            window.getSelection()?.removeAllRanges();
            setSelection(null);
          }}
          className="fixed z-40 flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-full border border-primary/25 bg-surface px-3 py-1.5 text-[12px] font-semibold text-ai shadow-[var(--shadow-float)] transition-transform hover:scale-105"
        >
          <Sparkles className="h-3 w-3" /> Ask AI
        </button>
      )}

      {!atBottom && (
        <button
          onClick={() => {
            scrollToBottom();
            markRoomRead(activeRoom.id);
          }}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-medium shadow-[var(--shadow-float)] transition-colors hover:bg-secondary"
        >
          <ArrowDown className="h-3.5 w-3.5" /> Jump to latest
        </button>
      )}
    </div>
  );
}
