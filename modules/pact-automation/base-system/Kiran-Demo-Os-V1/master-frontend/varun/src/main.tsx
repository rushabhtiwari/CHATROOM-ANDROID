import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ChatProvider } from '@/lib/chat-store';
import { AgentDockProvider } from '@/lib/agent-dock';
import { I18nProvider } from '@/lib/i18n';
import { RtsProvider } from '@/modules/rts/store';
import { ProjectsProvider } from '@/modules/projects/store';
import { Toaster } from '@/components/ui/sonner';
import './index.css';

/**
 * Three stores sit above the router because each outlives any single route: the
 * conversation store keeps its transport and outbox open while the user is
 * reading a report, the reimbursement store holds one server-sent events
 * subscription for the whole session rather than one per screen, and the
 * project store carries its localStorage snapshot across every project screen.
 *
 * The project store takes no network at all — see the note at the top of
 * `modules/projects/store.tsx` for why projects stay out of the backend.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ChatProvider>
          <AgentDockProvider>
            <RtsProvider>
              <ProjectsProvider>
                <App />
                <Toaster position="top-right" closeButton />
              </ProjectsProvider>
            </RtsProvider>
          </AgentDockProvider>
        </ChatProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
