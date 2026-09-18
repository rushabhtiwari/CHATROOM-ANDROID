import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ChatProvider } from '@/lib/chat-store';
import { AgentDockProvider } from '@/lib/agent-dock';
import { I18nProvider } from '@/lib/i18n';
import { RtsProvider } from '@/modules/rts/store';
import { WorkspaceProvider } from '@/lib/workspace';
import { Toaster } from '@/components/ui/sonner';
import './index.css';

/**
 * Two stores sit above the router because both outlive any single route: the
 * conversation store keeps its transport and outbox open while the user is
 * reading a report, and the reimbursement store holds one server-sent events
 * subscription for the whole session rather than one per screen.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ChatProvider>
          <AgentDockProvider>
            <RtsProvider>
              <WorkspaceProvider>
                <App />
                <Toaster position="top-right" closeButton />
              </WorkspaceProvider>
            </RtsProvider>
          </AgentDockProvider>
        </ChatProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
