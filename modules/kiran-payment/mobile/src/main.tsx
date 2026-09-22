import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ChatProvider } from '@/lib/chat-store';
import { I18nProvider } from '@/lib/i18n';
import { RtsProvider } from '@/modules/rts/store';
import { Toaster } from '@/components/ui/sonner';
import App from '~/App';
import { installDurableStorage } from '~/native/storage';
import { initShell } from '~/native/shell';
import { isNative } from '~/native/platform';
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
  await installDurableStorage(isNative);
  await initShell();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <I18nProvider>
          <ChatProvider>
            {/* The claim cards posted into conversations read from this. */}
            <RtsProvider>
              <App />
              <Toaster position="top-center" closeButton />
            </RtsProvider>
          </ChatProvider>
        </I18nProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

void bootstrap();
