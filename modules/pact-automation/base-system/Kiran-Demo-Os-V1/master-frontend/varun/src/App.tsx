import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { PactAutomation } from './pages/operations/PactAutomation';
import { MailingLayout } from './pages/mailing/MailingLayout';
import { MailsInbox } from './pages/mailing/MailsInbox';
import { OnHoldQueue } from './pages/mailing/OnHoldQueue';
import { MailingAnalytics } from './pages/mailing/MailingAnalytics';
import { AutomationLayout } from './pages/automation/AutomationLayout';
import { AutomationOrders } from './pages/automation/AutomationOrders';
import { AutomationKpac } from './pages/automation/AutomationKpac';
import { AutomationRules } from './pages/automation/AutomationRules';

/*
 * Kiran PACT Automation System.
 *
 * The console carries only the two working halves of the pipeline: the mailbox it
 * watches, and the orders on their way into PACT. Every other area of the original
 * KiranOS console is left out of the router, so nothing here leads to a page that is
 * not part of that path.
 */
export const App: React.FC = () => {
  return (
    <AppShell>
      <Routes>
        {/* Mail monitoring. The layout owns the control deck and the tab strip;
            the three sub-sections render into its outlet. */}
        <Route path="/admin/mailing" element={<MailingLayout />}>
          <Route index element={<Navigate to="/admin/mailing/inbox" replace />} />
          <Route path="inbox" element={<MailsInbox />} />
          <Route path="on-hold" element={<OnHoldQueue />} />
          <Route path="on-hold/:jobId" element={<OnHoldQueue />} />
          <Route path="analytics" element={<MailingAnalytics />} />
        </Route>
        <Route path="/admin/mail" element={<Navigate to="/admin/mailing/inbox" replace />} />

        {/* PACT entry. The orders board with its two gates, the KPAC bridge and the
            rules. `/admin/kpac` is an alias, because "the KPAC screen" is what people
            call it out loud. */}
        <Route path="/admin/automation" element={<AutomationLayout />}>
          <Route index element={<Navigate to="/admin/automation/orders" replace />} />
          <Route path="orders" element={<AutomationOrders />} />
          <Route path="orders/:jobId" element={<AutomationOrders />} />
          <Route path="kpac" element={<AutomationKpac />} />
          <Route path="rules" element={<AutomationRules />} />
        </Route>
        <Route path="/admin/kpac" element={<Navigate to="/admin/automation/kpac" replace />} />

        {/* The robot's own queue: entries, approval, verification results. */}
        <Route path="/pact" element={<PactAutomation />} />

        {/* Everything else lands on the mailbox. */}
        <Route path="*" element={<Navigate to="/admin/mailing/inbox" replace />} />
      </Routes>
    </AppShell>
  );
};

export default App;
