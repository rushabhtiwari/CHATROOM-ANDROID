import { useEffect } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChat } from '@/lib/chat-store';
import { renderApp, renderAt } from '~/test/render';
import { MessageBubble } from '~/screens/chat/MessageBubble';

const location = () => screen.getByTestId('location').textContent;
const composer = () => screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;

describe('chat list', () => {
  it('lists the seeded conversations, newest first', async () => {
    await renderApp('/chats');
    const rows = await screen.findAllByRole('button', { name: /./ });
    const titles = rows.map((row) => row.textContent ?? '');
    expect(titles.some((t) => t.includes('Plant Expansion — Unit 3'))).toBe(true);
    expect(titles.some((t) => t.includes('Watercooler'))).toBe(true);
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

  it('offers mentions from the room and inserts the token', async () => {
    await renderApp('/chats/r1');
    const box = composer();
    fireEvent.change(box, { target: { value: '@raj', selectionStart: 4 } });
    box.setSelectionRange(4, 4);
    fireEvent.keyUp(box);

    const list = await screen.findByRole('listbox');
    const option = within(list).getByRole('option', { name: /Rajat Khanna/ });
    fireEvent.click(option);

    expect(composer().value).toMatch(/^<@[\w-]+> $/);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
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
