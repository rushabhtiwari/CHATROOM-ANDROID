import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '~/test/render';

/**
 * The chat features beyond sending: profiles and photos, what a conversation
 * has shared, group settings, message actions, drafts, search and scheduling.
 * Each runs the real app over the real store.
 */

// Whole-app renders in jsdom: quick alone, slow when the full suite shares the
// machine. The default five seconds failed under load, not on behaviour.
vi.setConfig({ testTimeout: 20_000 });

const PHOTO = 'data:image/webp;base64,TESTPHOTO';

vi.mock('~/lib/photo', () => ({
  choosePhoto: vi.fn(async () => new File(['x'], 'me.png', { type: 'image/png' })),
}));
vi.mock('@/lib/profile-photo', async (original) => ({
  ...(await original<typeof import('@/lib/profile-photo')>()),
  // jsdom has no canvas to resize with.
  prepareProfilePhoto: vi.fn(async () => PHOTO),
}));

const location = () => screen.getByTestId('location').textContent;
const composer = () => screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
const dialog = (name: string | RegExp) => screen.getByRole('dialog', { name });

async function send(text: string) {
  fireEvent.change(composer(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  const shown = await screen.findByText(text);
  // Edit, delete and forward wait until the server has the message.
  await waitFor(() => expect(screen.queryByLabelText('Sending')).not.toBeInTheDocument());
  return shown;
}

/** Long-press on a phone, right-click in a browser: both open the actions. */
function actionsFor(text: string) {
  fireEvent.contextMenu(screen.getByText(text));
  return dialog('Message actions');
}

describe('profiles', () => {
  it("opens a sender's profile from their name, with the groups you share", async () => {
    await renderApp('/chats/r1');
    const [name] = await screen.findAllByRole('button', { name: 'Ananya Iyer' });
    fireEvent.click(name!);
    expect(location()).toBe('/people/u2');
    expect(screen.getByRole('heading', { name: 'Ananya Iyer', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/in common/)).toBeInTheDocument();
    expect(screen.getByText('Plant Expansion — Unit 3')).toBeInTheDocument();
  });

  it('messages them from their profile', async () => {
    await renderApp('/people/u2');
    fireEvent.click(await screen.findByRole('button', { name: 'Message' }));
    expect(location()).toBe('/chats/d1');
  });

  it('sets your own photo, and your avatar shows it', async () => {
    const view = await renderApp('/people/u1');
    fireEvent.click(await screen.findByRole('button', { name: 'Change my photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose from library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save photo' }));
    await waitFor(() =>
      expect(view.container.querySelector(`img[src="${PHOTO}"]`)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeInTheDocument();
  });

  it('offers no photo editing on somebody else', async () => {
    await renderApp('/people/u2');
    await screen.findByRole('button', { name: 'Message' });
    expect(screen.queryByRole('button', { name: 'Change my photo' })).not.toBeInTheDocument();
  });
});

describe('message actions', () => {
  it('edits your own message', async () => {
    await renderApp('/chats/r1');
    await send('Tpyo in this one');
    fireEvent.click(within(actionsFor('Tpyo in this one')).getByRole('button', { name: 'Edit' }));
    const sheet = dialog('Edit message');
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'Typo fixed' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Typo fixed')).toBeInTheDocument();
    expect(screen.getAllByText('edited').length).toBeGreaterThan(0);
  });

  it('deletes for everyone only after you confirm', async () => {
    await renderApp('/chats/r1');
    await send('Delete me');
    fireEvent.click(within(actionsFor('Delete me')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete me')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete for everyone' }));
    await waitFor(() => expect(screen.queryByText('Delete me')).not.toBeInTheDocument());
  });

  it("does not offer to edit someone else's message", async () => {
    await renderApp('/chats/r1');
    await send('mine');
    const [theirs] = await screen.findAllByRole('button', { name: 'Ananya Iyer' });
    const bubble = theirs!.parentElement!.querySelector('.rounded-2xl')!;
    fireEvent.contextMenu(bubble);
    const sheet = dialog('Message actions');
    expect(within(sheet).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Forward' })).toBeInTheDocument();
  });

  it('forwards a message to another conversation', async () => {
    await renderApp('/chats/r1');
    await send('Worth passing on');
    fireEvent.click(
      within(actionsFor('Worth passing on')).getByRole('button', { name: 'Forward' }),
    );
    const picker = dialog('Forward to');
    fireEvent.click(within(picker).getByRole('button', { name: /Watercooler/ }));
    fireEvent.click(within(picker).getByRole('button', { name: 'Forward' }));

    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    const row = (await screen.findByText('Watercooler')).closest('li')!;
    await waitFor(() => expect(within(row).getByText(/Worth passing on/)).toBeInTheDocument());
  });

  it('saves a message and finds it again under Saved', async () => {
    await renderApp('/chats/r1');
    await send('Keep this');
    fireEvent.click(within(actionsFor('Keep this')).getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    fireEvent.click(await screen.findByRole('button', { name: /Saved/ }));
    expect(location()).toBe('/saved');
    expect(await screen.findByText('Keep this')).toBeInTheDocument();
  });
});

describe('group info', () => {
  it('opens from the conversation header', async () => {
    await renderApp('/chats/r1');
    fireEvent.click(await screen.findByRole('button', { name: 'Conversation info' }));
    expect(location()).toBe('/chats/r1/info');
  });

  it('lets an admin rename the group', async () => {
    await renderApp('/chats/r1/info');
    fireEvent.click(await screen.findByRole('button', { name: /Plant Expansion — Unit 3/ }));
    const sheet = dialog('Group name');
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'Unit 3 Build' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: /Unit 3 Build/ })).toBeInTheDocument();
  });

  it('removes a member only after you confirm', async () => {
    await renderApp('/chats/r1/info');
    fireEvent.click(await screen.findByRole('button', { name: /Rajat Khanna/ }));
    fireEvent.click(
      within(dialog('Rajat Khanna')).getByRole('button', { name: 'Remove from group' }),
    );
    // The question comes first; Rajat is still a member.
    const confirm = dialog('Remove Rajat Khanna?');
    expect(screen.getByRole('button', { name: /Rajat Khanna/ })).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove from group' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Rajat Khanna/ })).not.toBeInTheDocument(),
    );
  });

  it('revokes the invite link only after you confirm', async () => {
    await renderApp('/chats/r2/info');
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke link' }));
    expect(screen.getByText('SLS900')).toBeInTheDocument();
    fireEvent.click(
      within(dialog('Revoke this invite link?')).getByRole('button', { name: 'Revoke link' }),
    );
    await waitFor(() => expect(screen.queryByText('SLS900')).not.toBeInTheDocument());
  });

  it("a direct chat's info is the other person's profile", async () => {
    await renderApp('/chats/d1/info');
    await waitFor(() => expect(location()).toBe('/people/u2'));
  });

  it('shows the links a conversation has shared', async () => {
    await renderApp('/chats/r1');
    fireEvent.change(composer(), { target: { value: 'Spec is at https://example.com/spec' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText(/Spec is at/);
    fireEvent.click(screen.getByRole('button', { name: 'Conversation info' }));
    fireEvent.click(await screen.findByText('Media, links and docs'));
    fireEvent.click(screen.getByRole('tab', { name: /Links/ }));
    expect(screen.getByText('https://example.com/spec')).toBeInTheDocument();
  });
});

describe('starting conversations', () => {
  it('creates a named group from the people you pick', async () => {
    await renderApp('/chats/new');
    fireEvent.click(await screen.findByText('New group'));
    fireEvent.click(screen.getByRole('button', { name: /Ananya Iyer/ }));
    fireEvent.click(screen.getByRole('button', { name: /Arjun Bhatt/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Group name' }), {
      target: { value: 'Launch crew' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('heading', { name: 'Launch crew' })).toBeInTheDocument();
    expect(location()).toMatch(/^\/chats\/.+/);
  });

  it("tells the group's only admin to promote someone before leaving, and stays put", async () => {
    await renderApp('/chats/new');
    fireEvent.click(await screen.findByText('New group'));
    fireEvent.click(screen.getByRole('button', { name: /Ananya Iyer/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Group name' }), {
      target: { value: 'Solo admin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Conversation info' }));
    const info = location();

    fireEvent.click(await screen.findByRole('button', { name: 'Leave group' }));
    expect(dialog('Make someone else an admin first')).toBeInTheDocument();
    fireEvent.click(
      within(dialog('Make someone else an admin first')).getByRole('button', { name: 'OK' }),
    );
    expect(location()).toBe(info);
  });
});

describe('the list', () => {
  it('finds messages as well as conversations, and opens one where it was said', async () => {
    await renderApp('/chats');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search conversations' }), {
      target: { value: 'fifteen years' },
    });
    const heading = await screen.findByText('Messages');
    const results = heading.nextElementSibling as HTMLElement;
    fireEvent.click(within(results).getAllByRole('button')[0]!);
    expect(location()).toMatch(/^\/chats\/[^/]+$/);
  });

  it('keeps what you were typing as a draft, and shows it in the list', async () => {
    await renderApp('/chats/r1');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Message' }), {
      target: { value: 'half written thought' },
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    expect(await screen.findByText('Draft:')).toBeInTheDocument();
    expect(screen.getByText('half written thought')).toBeInTheDocument();
  });
});

describe('scheduling', () => {
  it('queues a message to send later and says so in the conversation', async () => {
    await renderApp('/chats/r1');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Message' }), {
      target: { value: 'Reminder for tomorrow' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send later' }));
    fireEvent.click(within(dialog('Send later')).getByRole('button', { name: /Schedule for/ }));
    expect(await screen.findByText('1 scheduled message')).toBeInTheDocument();
    expect(composer().value).toBe('');
  });
});

describe('instant meeting links', () => {
  it('are not offered in a group, where the store can only refuse them', async () => {
    await renderApp('/chats/r1');
    fireEvent.click(await screen.findByRole('button', { name: 'Attach' }));
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Meet now' })).not.toBeInTheDocument();
  });

  it('are offered in a one-to-one chat', async () => {
    await renderApp('/chats/d1');
    fireEvent.click(await screen.findByRole('button', { name: 'Attach' }));
    expect(screen.getByRole('button', { name: 'Meet now' })).toBeInTheDocument();
  });
});
