import { useEffect } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '@/lib/chat-store';
import { renderApp, renderAt } from '~/test/render';
import { MessageBubble } from '~/screens/chat/MessageBubble';
import { handleBack } from '~/native/back-button';

const location = () => screen.getByTestId('location').textContent;
const composer = () => screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;

describe('chat list', () => {
  it('lists the seeded conversations, newest first', async () => {
    await renderApp('/chats');
    // People & HR's last message is the seed's most recent; Engineering's is
    // hours older. Text queries, not role queries: computing accessible names
    // for every row in the list is slow enough in jsdom to time a test out.
    const recent = await screen.findByText('People & HR');
    const older = screen.getByText('Engineering');
    expect(recent.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Watercooler')).toBeInTheDocument();
  });

  it('narrows the list as you search', async () => {
    await renderApp('/chats');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search conversations' }), {
      target: { value: 'water' },
    });
    expect(screen.getByText('Watercooler')).toBeInTheDocument();
    expect(screen.queryByText('Plant Expansion — Unit 3')).not.toBeInTheDocument();
  });

  it('says so when nothing matches, rather than showing nothing', async () => {
    await renderApp('/chats');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search conversations' }), {
      target: { value: 'zzzz no such room' },
    });
    expect(screen.getByText('No conversations match')).toBeInTheDocument();
  });

  it('opens a conversation when a row is tapped', async () => {
    await renderApp('/chats');
    fireEvent.click(screen.getByText('Watercooler'));
    expect(location()).toBe('/chats/s-watercooler');
  });
});

describe('conversation', () => {
  it('shows the room and its messages', async () => {
    await renderApp('/chats/r1');
    expect(screen.getByRole('heading', { name: 'Plant Expansion — Unit 3' })).toBeInTheDocument();
    expect(await screen.findByText(/Board pack is drafted/)).toBeInTheDocument();
  });

  it('hides the tab bar, since the composer takes its place', async () => {
    await renderApp('/chats/r1');
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
  });

  it('sends a message: it appears at once and the composer empties', async () => {
    await renderApp('/chats/r1');
    fireEvent.change(composer(), { target: { value: 'Sent from the phone test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Sent from the phone test')).toBeInTheDocument();
    expect(composer().value).toBe('');
  });

  it('will not send an empty message', async () => {
    await renderApp('/chats/r1');
    fireEvent.change(composer(), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('offers mentions from the room, shows the name, and sends the token', async () => {
    await renderApp('/chats/r1');
    const box = composer();
    fireEvent.change(box, { target: { value: '@raj', selectionStart: 4 } });
    box.setSelectionRange(4, 4);
    fireEvent.keyUp(box);

    const list = await screen.findByRole('listbox');
    const option = within(list).getByRole('option', { name: /Rajat Khanna/ });
    fireEvent.click(option);

    // The writer reads a name, never the stored `<@u…>` encoding.
    expect(composer().value).toBe('@Rajat Khanna ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.change(composer(), { target: { value: '@Rajat Khanna can you check?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    // Sent as the token, so it renders as a mention of its own — typed text
    // would sit inside the paragraph instead.
    const sent = await screen.findByText(/can you check\?/);
    expect(within(sent).getByText('@Rajat Khanna').tagName).toBe('SPAN');
  });

  it('only offers people who are in the room', async () => {
    await renderApp('/chats/r1');
    const box = composer();
    fireEvent.change(box, { target: { value: '@' } });
    box.setSelectionRange(1, 1);
    fireEvent.keyUp(box);
    const list = await screen.findByRole('listbox');
    // r1 has six members; the viewer is excluded, and the list is capped.
    expect(within(list).getAllByRole('option').length).toBeGreaterThan(1);
    expect(within(list).queryByRole('option', { name: /Kavya Reddy/ })).not.toBeInTheDocument();
  });

  it('opens the assistant sheet as soon as @agent is asked', async () => {
    await renderApp('/chats/r1');
    fireEvent.change(composer(), { target: { value: '@agent what was decided?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask the assistant' }));
    expect(await screen.findByRole('dialog', { name: 'Assistant' })).toBeInTheDocument();
    expect(screen.getByText(/what was decided\?/)).toBeInTheDocument();
  });

  it('opens a thread from its reply count and goes back to the room', async () => {
    await renderApp('/chats/r1');
    const [chip] = await screen.findAllByRole('button', { name: /1 reply/ });
    fireEvent.click(chip!);
    expect(location()).toMatch(/^\/chats\/r1\/thread\/.+/);
    expect(screen.getByRole('heading', { name: 'Thread' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to conversation' }));
    expect(location()).toBe('/chats/r1');
  });

  it('gives an unknown conversation a way back instead of a dead end', async () => {
    await renderApp('/chats/no-such-room');
    expect(screen.getByText('Conversation not found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(location()).toBe('/chats');
  });

  it('shows the pinned message as plain text, not markdown source', async () => {
    await renderApp('/chats/r1');
    const banner = await screen.findByText(/Machine decision is due Friday/, {
      selector: 'button span',
    });
    expect(banner.textContent).not.toContain('**');
  });
});

describe('claim card in a message', () => {
  /** Posts a message carrying a claim, the way the claim composer does. */
  function PostClaim({ onPosted }: { onPosted: (id: string) => void }) {
    const { sendMessage, channelMessages, setActiveRoom } = useChat();
    useEffect(() => {
      setActiveRoom('r1');
      sendMessage('r1', 'Filed the site-visit travel.', { claimId: 'REQ-2026-0103' });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const posted = channelMessages.find((m) => m.claimId === 'REQ-2026-0103');
    useEffect(() => {
      if (posted) onPosted(posted.id);
    }, [posted, onPosted]);
    return posted ? (
      <MessageBubble message={posted} showSender onReply={() => {}} onReact={() => {}} />
    ) : null;
  }

  it("renders the console's claim card with the claim read from the server", async () => {
    let postedId = '';
    renderAt(<PostClaim onPosted={(id) => (postedId = id)} />, { route: '/' });
    await waitFor(() => expect(postedId).not.toBe(''));
    // Title, number and amount all come from /api/state, not from the message.
    expect(await screen.findByText('Vendor audit - Bengaluru')).toBeInTheDocument();
    expect(screen.getByText(/REQ-2026-0103/)).toBeInTheDocument();
    expect(screen.getByText('₹26,800')).toBeInTheDocument();
  });
});

describe('a reply shared from the assistant', () => {
  /** A seeded message, marked the way "Share to Chat" marks one. */
  function SharedFromAi() {
    const { channelMessages, setActiveRoom } = useChat();
    useEffect(() => {
      setActiveRoom('r1');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const base = channelMessages[channelMessages.length - 1];
    return base ? (
      <MessageBubble
        message={{ ...base, sharedFromAi: true }}
        showSender
        onReply={() => {}}
        onReact={() => {}}
      />
    ) : null;
  }

  it("says the words are the assistant's, as the console does", async () => {
    renderAt(<SharedFromAi />, { route: '/' });
    expect(await screen.findByText('Shared from AI Agent')).toBeInTheDocument();
  });
});

describe('scheduling a meeting', () => {
  it('will not continue until someone is picked', async () => {
    await renderApp('/chats/r1/schedule');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('counts a person once however fast they are tapped', async () => {
    await renderApp('/chats/r1/schedule');
    const rajat = screen.getByRole('button', { name: /Rajat Khanna/ });
    // Three taps inside one batch — before React re-renders between them. The
    // toggle used to decide from the render's snapshot, so every tap saw
    // "not picked" and the same person was added three times.
    act(() => {
      rajat.click();
      rajat.click();
      rajat.click();
    });
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('walks every step to a review that reflects each answer', async () => {
    await renderApp('/chats/r1/schedule');
    fireEvent.click(screen.getByRole('button', { name: /Rajat Khanna/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Meeting title' }), {
      target: { value: 'Battenfeld decision' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })); // default slot
    fireEvent.click(screen.getByRole('button', { name: '45 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })); // no notes

    expect(screen.getByRole('heading', { name: 'Ready to send?' })).toBeInTheDocument();
    expect(screen.getByText('Battenfeld decision')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('Rajat Khanna')).toBeInTheDocument();
  });

  it("steps back a question on Android's back button, keeping the answers", async () => {
    await renderApp('/chats/r1/schedule');
    fireEvent.click(screen.getByRole('button', { name: /Rajat Khanna/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'What is it about?' })).toBeInTheDocument();

    act(() => {
      expect(handleBack(true)).toBe('closed');
    });
    expect(screen.getByRole('heading', { name: 'Who should be there?' })).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(location()).toBe('/chats/r1/schedule');
  });

  it('backs out of the first question to the conversation', async () => {
    await renderApp('/chats/r1/schedule');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(location()).toBe('/chats/r1');
  });

  it('lets any answer be edited from the review', async () => {
    await renderApp('/chats/r1/schedule');
    fireEvent.click(screen.getByRole('button', { name: /Rajat Khanna/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Meeting title' }), {
      target: { value: 'First title' },
    });
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const [editTitle] = screen.getAllByRole('button', { name: 'Edit' });
    fireEvent.click(editTitle!);
    expect(screen.getByRole('heading', { name: 'What is it about?' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Meeting title' })).toHaveValue('First title');
  });
});

describe('opening the app at a conversation (a tapped notification)', () => {
  /**
   * The real sequence: the app was last used in one room, so the saved
   * workspace names that room as active; then it is cold-started at another,
   * which is what tapping a notification does.
   */
  async function lastUsedIn(room: string) {
    const first = await renderApp(`/chats/${room}`);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('kiranos-chat-v1') ?? '{}').activeRoomId).toBe(room),
    );
    first.unmount();
  }

  it('shows the conversation in the URL, not the one open last time', async () => {
    await lastUsedIn('r1');
    await renderApp('/chats/s-watercooler');
    expect(await screen.findByRole('heading', { name: 'Watercooler' })).toBeInTheDocument();
    expect(screen.queryByText(/Board pack is drafted/)).not.toBeInTheDocument();
  });

  it('schedules with the members of the conversation in the URL', async () => {
    await lastUsedIn('r1');
    await renderApp('/chats/s-watercooler/schedule');
    expect(await screen.findByText('Watercooler')).toBeInTheDocument();
  });

  it('opens a thread against the conversation in the URL', async () => {
    await lastUsedIn('s-watercooler');
    await renderApp('/chats/r1');
    const [chip] = await screen.findAllByRole('button', { name: /1 reply/ });
    fireEvent.click(chip!);
    expect(await screen.findByRole('heading', { name: 'Thread' })).toBeInTheDocument();
    expect(screen.queryByText('Thread not found')).not.toBeInTheDocument();
  });
});

describe('older history', () => {
  /** A saved workspace in which Watercooler has 120 more messages than it seeds with. */
  async function longHistory() {
    const first = await renderApp('/chats/s-watercooler');
    await waitFor(() => expect(localStorage.getItem('kiranos-chat-v1')).not.toBeNull());
    first.unmount();
    const snap = JSON.parse(localStorage.getItem('kiranos-chat-v1')!);
    const template = snap.messages.find(
      (m: { roomId: string; system?: boolean }) => m.roomId === 's-watercooler' && !m.system,
    );
    // Older than every seeded message, so the seed's own messages never
    // interleave with these. The seed is timestamped relative to the current
    // day; anchoring to "now" instead made the counts depend on the time of day.
    const oldest = Math.min(...snap.messages.map((m: { timestamp: number }) => m.timestamp));
    const base = oldest - 200 * 60_000;
    for (let i = 0; i < 120; i++) {
      snap.messages.push({
        ...template,
        id: `hist-${i}`,
        clientId: `hc-${i}`,
        content: `History ${i}`,
        timestamp: base + i * 60_000,
        reactions: undefined,
        replyToId: null,
        threadRootId: null,
        pinnedBy: undefined,
      });
    }
    localStorage.setItem('kiranos-chat-v1', JSON.stringify(snap));
  }

  const scroller = () => document.querySelector('.scroll-y') as HTMLElement;
  const loaded = () => screen.queryAllByText(/^History \d+$/).length;

  it('opens on one page, not the whole history', async () => {
    await longHistory();
    await renderApp('/chats/s-watercooler');
    await screen.findByText('History 119');
    expect(screen.queryByText('History 0')).not.toBeInTheDocument();
  });

  /**
   * jsdom has no layout: scrollHeight is always 0 and scrollTop does not stick,
   * so "where is the reader" cannot be observed. Give the scroller a simple
   * model instead — every loaded message is 60px tall, the frame 600px — which
   * is enough to check both the paging and the restore arithmetic.
   */
  function giveGeometry(node: HTMLElement) {
    let top = 0;
    Object.defineProperty(node, 'scrollHeight', { configurable: true, get: () => loaded() * 60 });
    Object.defineProperty(node, 'clientHeight', { configurable: true, get: () => 600 });
    Object.defineProperty(node, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => (top = Math.max(0, Math.min(value, loaded() * 60 - 600))),
    });
  }

  it('loads one page per trip to the top, and keeps the reader in place', async () => {
    await longHistory();
    await renderApp('/chats/s-watercooler');
    await screen.findByText('History 119');
    const node = scroller();
    giveGeometry(node);
    const before = loaded();

    node.scrollTop = 0;
    // Momentum scrolling delivers a burst of events at the top, and they can
    // all arrive before React commits the first page — so they are dispatched
    // inside one batch here, where no render can land between them. Only the
    // first may ask for a page; the rest used to ask again, and again, until
    // the whole history had loaded.
    act(() => {
      node.dispatchEvent(new Event('scroll'));
      node.dispatchEvent(new Event('scroll'));
      node.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => expect(loaded()).toBeGreaterThan(before));
    expect(loaded()).toBe(before + 40);
    // The reader was at the top of the old page; that message is now 40
    // messages (2400px) down, and so is the reader.
    expect(node.scrollTop).toBe(40 * 60);
  });
});

describe('scheduling never offers the past', () => {
  // Only Date is faked: the chat store's timers must keep running.
  const at = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };
  afterEach(() => vi.useRealTimers());

  async function toWhenStep() {
    await renderApp('/chats/r1/schedule');
    fireEvent.click(screen.getByRole('button', { name: /Rajat Khanna/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Meeting title' }), {
      target: { value: 'Review' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  }

  it("disables today's slots that have already passed", async () => {
    at('2026-09-28T15:10:00');
    await toWhenStep();
    expect(screen.getByRole('button', { name: '09:00' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '15:00' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '15:30' })).toBeEnabled();
  });

  it('starts on the next slot still ahead, not a fixed 10:00', async () => {
    at('2026-09-28T15:10:00');
    await toWhenStep();
    expect(screen.getByRole('button', { name: '15:30' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts on tomorrow when today has no slots left', async () => {
    at('2026-09-28T19:00:00');
    await toWhenStep();
    expect(screen.getByRole('button', { name: '09:00' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '09:00' })).toBeEnabled();
  });

  it('opens every slot again on a later day', async () => {
    at('2026-09-28T15:10:00');
    await toWhenStep();
    const tomorrow = screen.getAllByRole('button', { name: /^\w{3} 29$/ })[0]!;
    fireEvent.click(tomorrow);
    expect(screen.getByRole('button', { name: '09:00' })).toBeEnabled();
  });

  it('refuses to create a meeting whose time passed while the screen sat open', async () => {
    at('2026-09-28T15:10:00');
    await toWhenStep();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })); // 15:30
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })); // duration
    fireEvent.click(screen.getByRole('button', { name: 'Continue' })); // notes

    vi.setSystemTime(new Date('2026-09-28T15:45:00'));
    fireEvent.click(screen.getByRole('button', { name: /Create and send/ }));
    expect(await screen.findByText(/has already passed/)).toBeInTheDocument();
    expect(location()).toBe('/chats/r1/schedule');
  });
});
