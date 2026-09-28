import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { ChatProvider } from '@/lib/chat-store';
import { I18nProvider } from '@/lib/i18n';
import { RtsProvider } from '@/modules/rts/store';
import App from '~/App';
import state from './fixtures/state.json';

/**
 * Stand in for the network, and nothing else.
 *
 * The providers are the real ones: `ChatProvider` runs its actual store over
 * its actual seed, so a test that sends a message exercises the same delivery
 * path the app does. Only the two things jsdom cannot do are faked — the
 * server (`fetch`, answered from a snapshot captured from the real backend)
 * and the live-update stream (`EventSource`, which jsdom does not have).
 */
export function fakeServer() {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      requests.push(url);
      if (url.endsWith('/api/state')) return Response.json(state);
      return new Response('Not in the test server', { status: 404 });
    }),
  );
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener() {}
      close() {}
    },
  );
  return { requests };
}

/** The current path, rendered where a test can read it. */
function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

/**
 * Render `element` at `route`, inside the app's real providers.
 *
 * `path` is the route pattern the element is mounted under, so screens that
 * read params (`/chats/:roomId`) get them.
 */
export function renderAt(
  element: ReactElement,
  { route, path = route }: { route: string; path?: string },
) {
  fakeServer();
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>
        <ChatProvider>
          <RtsProvider>
            <Routes>
              <Route path={path} element={element} />
              <Route path="*" element={null} />
            </Routes>
            <Location />
          </RtsProvider>
        </ChatProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

/**
 * Render the whole app at `route` — tab bar, routing and all.
 *
 * `App` is imported statically above, not here. Importing it inside the call
 * put the cost of compiling the whole app (the console's source included)
 * inside the first timed test of every file, which passed on an idle machine
 * and timed out on a busy one.
 */
export async function renderApp(route: string) {
  fakeServer();
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>
        <ChatProvider>
          <RtsProvider>
            <App />
            <Location />
          </RtsProvider>
        </ChatProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}
