import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@capacitor/app';
import { Sheet } from '~/components/Sheet';
import { handleBack, useBackButtonNavigation } from '~/native/back-button';

vi.mock('@capacitor/app', () => ({
  App: { minimizeApp: vi.fn(async () => {}), addListener: vi.fn() },
}));

afterEach(() => vi.clearAllMocks());

/** Stands in for the app registering its router. */
function Router({ navigate }: { navigate: (to: string, options: { replace: boolean }) => void }) {
  useBackButtonNavigation(navigate);
  return null;
}

describe("Android's back button", () => {
  it('closes the newest open sheet first, then the one under it', () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    const { rerender, unmount } = render(
      <>
        <Sheet onClose={closeFirst} title="First">
          one
        </Sheet>
        <Sheet onClose={closeSecond} title="Second">
          two
        </Sheet>
      </>,
    );

    expect(handleBack(true, '/chats/r1')).toBe('closed');
    expect(closeSecond).toHaveBeenCalledTimes(1);
    expect(closeFirst).not.toHaveBeenCalled();

    // Its owner closes the second sheet; back now reaches the first.
    rerender(
      <>
        <Sheet onClose={closeFirst} title="First">
          one
        </Sheet>
      </>,
    );
    expect(handleBack(true, '/chats/r1')).toBe('closed');
    expect(closeFirst).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('steps back through history on an inner screen', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    expect(handleBack(true, '/chats/r1/info')).toBe('back');
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it('leaves the app from Chats, however much history is behind it', () => {
    expect(handleBack(true, '/chats')).toBe('background');
    expect(App.minimizeApp).toHaveBeenCalledTimes(1);
  });

  it('goes to Chats from any other tab', () => {
    const navigate = vi.fn();
    const { unmount } = render(<Router navigate={navigate} />);
    expect(handleBack(true, '/orders')).toBe('home');
    expect(navigate).toHaveBeenCalledWith('/chats', { replace: true });
    unmount();
  });

  it('goes to Chats from a screen opened with nothing behind it', () => {
    const navigate = vi.fn();
    const { unmount } = render(<Router navigate={navigate} />);
    expect(handleBack(false, '/chats/r1')).toBe('home');
    expect(navigate).toHaveBeenCalledWith('/chats', { replace: true });
    unmount();
  });
});
