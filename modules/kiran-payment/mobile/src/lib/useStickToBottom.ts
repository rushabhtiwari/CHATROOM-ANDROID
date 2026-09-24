import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

/** How close to the bottom still counts as "at the bottom", in pixels. */
const THRESHOLD = 80;

/**
 * Keep a message list pinned to its newest entry — while the reader is there.
 *
 * Re-scrolling when the message count changes is not enough. A bubble can
 * grow after it first renders: a claim card fetches its claim, an image
 * decodes, a link preview arrives. Each of those pushes the newest message
 * down under the composer, and a count-based effect never fires for them. So
 * this watches the content's size instead, which catches every cause at once.
 *
 * It only follows while the reader is already at the bottom. Someone scrolled
 * up into history is reading; yanking them back down on every resize would be
 * worse than leaving the newest message one screen away.
 *
 * `scroller` is the overflow container; `content` is the element inside it
 * whose height changes. `resetKey` identifies what is being shown — a room, a
 * thread — and a new value starts at the bottom again: the screen component
 * survives navigating between rooms, and "the reader scrolled up" in one room
 * says nothing about the next. Returns the scroll handler that tracks position.
 */
export function useStickToBottom(
  scroller: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  resetKey: string | undefined,
  onScrollExtra?: (node: HTMLElement) => void,
) {
  const pinned = useRef(true);
  // The geometry the last scroll event was judged against. See onScroll.
  const measured = useRef({ scrollHeight: 0, clientHeight: 0 });

  const remember = (node: HTMLElement) => {
    measured.current = { scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
  };

  const toBottom = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    remember(node);
  }, [scroller]);

  useLayoutEffect(() => {
    pinned.current = true;
    toBottom();
  }, [resetKey, toBottom]);

  // Re-attached per `resetKey` as well: if the first render for a key was an
  // empty or not-found state, the elements did not exist when this last ran.
  useLayoutEffect(() => {
    const target = content.current;
    const frame = scroller.current;
    // jsdom and a handful of old WebViews have no ResizeObserver. Without it the
    // list still lands at the bottom on open; it just does not re-follow growth.
    if (!target || !frame || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (pinned.current) toBottom();
    });
    // The content grows when a bubble loads something. The frame shrinks when
    // the iOS keyboard opens, which would otherwise hide the newest message
    // behind the composer the moment the reader starts to reply.
    observer.observe(target);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [content, scroller, toBottom, resetKey]);

  const onScroll = useCallback(() => {
    const node = scroller.current;
    if (!node) return;

    // A scroll event is only evidence of where the *reader* is if the layout
    // has not moved underneath it. Scroll events are dispatched before resize
    // observations within a frame, so after our own scroll-to-bottom, a bubble
    // that grows in the same frame (a claim card receiving its data) makes the
    // queued event report "far from the bottom" — and the observer that runs
    // next would then decline to follow. When the geometry has changed since
    // it was last measured, the movement is layout, not the reader: note the
    // new geometry and leave the decision to the observer.
    const { scrollHeight, clientHeight } = measured.current;
    if (node.scrollHeight !== scrollHeight || node.clientHeight !== clientHeight) {
      remember(node);
    } else {
      pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < THRESHOLD;
    }
    onScrollExtra?.(node);
  }, [scroller, onScrollExtra]);

  return { onScroll, isPinned: () => pinned.current };
}
