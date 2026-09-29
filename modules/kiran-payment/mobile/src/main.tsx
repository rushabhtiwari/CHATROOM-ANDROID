import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ChatProvider } from '@/lib/chat-store';
import { createLocalLog } from '@/lib/chat-log';
import { I18nProvider } from '@/lib/i18n';
import { RtsProvider } from '@/modules/rts/store';
import { Toaster } from '@/components/ui/sonner';
import App from '~/App';
import { CallProvider } from '~/calls/CallProvider';
import { installDurableStorage } from '~/native/storage';
import { initShell } from '~/native/shell';
import { isNative } from '~/native/platform';
import { API_ORIGIN } from '~/api/origin';
import { installServerOrigin } from '~/api/install';
import { STANDALONE } from '~/local/config';
import '~/index.css';

/**
 * Nothing renders until storage is real.
 *
 * `ChatProvider` reads the saved snapshot during its first render. On a device
 * that snapshot lives in Preferences, which can only be read asynchronously,
 * so the swap has to complete before React is allowed to mount — otherwise the
 * first render sees an empty workspace, seeds a fresh one, and writes that
 * over the conversations the user actually had.
 */
async function bootstrap() {
  // Before anything can make a request: RtsProvider fetches on mount and opens
  // its event stream, and those must already be pointed at the real server.
  if (!STANDALONE) installServerOrigin(API_ORIGIN);
  await installDurableStorage(isNative);
  // A standalone build answers those requests itself (src/local). Imported
  // only now, after the storage swap, so its stores load what was saved.
  if (STANDALONE) {
    const { startLocalServer } = await import('~/local');
    startLocalServer();
  }
  await initShell();

  // Chat with no server keeps its log on the device, as the console does
  // offline — without the simulated latency and failures.
  const chatLog = STANDALONE ? createLocalLog({ failureRate: 0, latency: 0 }) : undefined;

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <I18nProvider>
          <ChatProvider log={chatLog}>
            {/* The claim cards posted into conversations read from this. */}
            <RtsProvider>
              {/* Listens for calls to whoever is signed in, on every screen. */}
              <CallProvider>
                <App />
                <Toaster position="top-center" closeButton />
              </CallProvider>
            </RtsProvider>
          </ChatProvider>
        </I18nProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

void bootstrap();
