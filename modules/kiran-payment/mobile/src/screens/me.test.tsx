import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * The shim's failure channel, controllable. On a device the real one is fed
 * by Preferences writes; here the test decides when saving breaks.
 */
const storage = vi.hoisted(() => {
  const listeners = new Set<(error: unknown) => void>();
  let current: unknown = null;
  return {
    installDurableStorage: async () => {},
    storageError: () => current,
    onStorageFailure: (listener: (error: unknown) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(error: unknown) {
      current = error;
      for (const listener of listeners) listener(error);
    },
  };
});
vi.mock('~/native/storage', () => storage);

const { renderApp } = await import('~/test/render');

describe('saving to the phone', () => {
  it('says so on the Me screen when saves stop reaching the phone, and when they recover', async () => {
    await renderApp('/me');
    expect(screen.getByText('Healthy')).toBeInTheDocument();

    act(() => storage.emit(new Error('disk full')));
    expect(screen.getByText('Not saving to this phone')).toBeInTheDocument();

    act(() => storage.emit(null));
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('warns on the chat list, where people are writing', async () => {
    await renderApp('/chats');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => storage.emit(new Error('disk full')));
    expect(screen.getByRole('alert')).toHaveTextContent('not saving new messages');
    act(() => storage.emit(null));
  });
});
