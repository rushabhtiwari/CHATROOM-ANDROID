import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { useChat } from '@/lib/chat-store';
import { SHARED_HOME, useWorkspace, workspaceByKey } from '@/lib/workspace';

// Sales, Marketing & RFQ, Dispatch
import { EmailIntake } from './pages/revenue/EmailIntake';
import { EmailDetail } from './pages/revenue/EmailDetail';
import { RFQList } from './pages/revenue/RFQList';
import { RFQDetail } from './pages/revenue/RFQDetail';
import { QuotationList } from './pages/revenue/QuotationList';
import { QuotationBuilder } from './pages/revenue/QuotationBuilder';
import { SamplesList } from './pages/revenue/SamplesList';
import { OrdersList } from './pages/revenue/OrdersList';
import { OrderDetail } from './pages/revenue/OrderDetail';
import { DispatchBoard } from './pages/revenue/DispatchBoard';
import { DispatchDetail } from './pages/revenue/DispatchDetail';

// Accounts & Finance
import { ReportsHub } from './pages/finance/ReportsHub';
import { ReportDetail } from './pages/finance/ReportDetail';
import { AccountsOverview } from './pages/finance/AccountsOverview';
import { BankReconciliation } from './pages/finance/BankReconciliation';
import { Receivables } from './pages/finance/Receivables';
import { Payables } from './pages/finance/Payables';

// Purchase, Requisitions, Production
import { RequisitionsList } from './pages/operations/RequisitionsList';
import { BudgetAllocation } from './pages/operations/BudgetAllocation';
import { PurchaseOverview } from './pages/operations/PurchaseOverview';
import { PurchaseRequests } from './pages/operations/PurchaseRequests';
import { VendorComparisonPage } from './pages/operations/VendorComparison';
import { PurchaseOrders } from './pages/operations/PurchaseOrders';
import { GRNThreeWayMatch } from './pages/operations/GRNThreeWayMatch';
import { ProjectsList } from './pages/operations/ProjectsList';
import { ProjectDetail } from './pages/operations/ProjectDetail';
import { ProductionPlan } from './pages/production/ProductionPlan';

// Quality
import { Inspections } from './pages/quality/Inspections';

// HR
import { HrOverview } from './pages/people/HrOverview';
import { Employees } from './pages/people/Employees';
import { Leave } from './pages/people/Leave';
import { Attendance } from './pages/people/Attendance';

// Expense claims: filed in a conversation, reviewed by HR, paid by Accounts
import { ReimbursementsList } from './pages/reimbursements/ReimbursementsList';
import { HrReview } from './pages/reimbursements/HrReview';
import { Disbursement } from './pages/reimbursements/Disbursement';
import { ClaimDetail } from './pages/reimbursements/ClaimDetail';
import { PaymentReceipt } from './pages/reimbursements/PaymentReceipt';

// Automation
import { ApprovalsInbox } from './pages/approvals/ApprovalsInbox';
import { CommitmentsList } from './pages/intelligence/CommitmentsList';
import { EscalationsBoard } from './pages/intelligence/EscalationsBoard';
import { AutomationsList } from './pages/system/AutomationsList';

// Shared by every department
import { Chatroom } from './pages/chat/Chatroom';
import { JoinRoom } from './pages/chat/JoinRoom';
import { Calendar } from './pages/calendar/Calendar';
import { ActivityFeed } from './pages/activity/ActivityFeed';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* A payment advice is a document an employee forwards to their bank.
          It deliberately carries no application chrome, so it sits outside
          the shell rather than inside it. */}
      <Route path="/receipt/:utr" element={<PaymentReceipt />} />

      {/* Where the Central Platform launcher sends each department tile. */}
      <Route path="/d/:key" element={<WorkspaceEntry />} />

      <Route path="*" element={<Console />} />
    </Routes>
  );
};

/**
 * `/d/<workspace>`: scope this tab to a department, become that department's
 * person, and go to its landing page.
 */
const WorkspaceEntry: React.FC = () => {
  const { key } = useParams();
  const target = workspaceByKey(key);
  const { enterWorkspace } = useWorkspace();
  const { storageReady, currentUser, setCurrentUserId } = useChat();
  const [entered, setEntered] = useState(false);
  const applied = useRef(false);

  useEffect(() => {
    // The chat store restores its saved identity when it mounts. Switching
    // before that finishes would be overwritten by the restore.
    if (!target || !storageReady || applied.current) return;
    applied.current = true;
    enterWorkspace(target.key);
    if (target.personaId && target.personaId !== currentUser.id) {
      setCurrentUserId(target.personaId);
    }
    setEntered(true);
  }, [target, storageReady, currentUser.id, enterWorkspace, setCurrentUserId]);

  if (!target) return <Navigate to={SHARED_HOME} replace />;
  if (!entered) return null;
  return <Navigate to={target.home} replace />;
};

const Home: React.FC = () => {
  const { home } = useWorkspace();
  return <Navigate to={home} replace />;
};

const Console: React.FC = () => {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Sales, Marketing & RFQ, Dispatch */}
        <Route path="/email" element={<EmailIntake />} />
        <Route path="/inbox" element={<Navigate to="/email" replace />} />
        <Route path="/email/:id" element={<EmailDetail />} />
        <Route path="/rfq" element={<RFQList />} />
        <Route path="/rfq/:id" element={<RFQDetail />} />
        <Route path="/quotations" element={<QuotationList />} />
        <Route path="/quotations/:id" element={<QuotationBuilder />} />
        <Route path="/samples" element={<SamplesList />} />
        <Route path="/orders" element={<OrdersList />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/dispatch" element={<DispatchBoard />} />
        <Route path="/dispatch/:id" element={<DispatchDetail />} />

        {/* Accounts & Finance */}
        <Route path="/reports" element={<ReportsHub />} />
        <Route path="/reports/:reportId" element={<ReportDetail />} />
        <Route path="/accounts" element={<AccountsOverview />} />
        <Route path="/accounts/reconciliation" element={<BankReconciliation />} />
        <Route path="/accounts/receivables" element={<Receivables />} />
        <Route path="/accounts/payables" element={<Payables />} />

        {/* Requisitions & Budget */}
        <Route path="/requisitions" element={<RequisitionsList />} />
        <Route path="/requisitions/budget" element={<BudgetAllocation />} />

        {/* Purchase & Procurement */}
        <Route path="/purchase" element={<PurchaseOverview />} />
        <Route path="/purchase/requests" element={<PurchaseRequests />} />
        <Route path="/purchase/rfq" element={<VendorComparisonPage />} />
        <Route path="/purchase/orders" element={<PurchaseOrders />} />
        <Route path="/purchase/grn" element={<GRNThreeWayMatch />} />

        {/* Production */}
        <Route path="/production" element={<ProductionPlan />} />
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />

        {/* Quality */}
        <Route path="/quality" element={<Inspections />} />

        {/* HR */}
        <Route path="/people" element={<HrOverview />} />
        <Route path="/people/employees" element={<Employees />} />
        <Route path="/people/leave" element={<Leave />} />
        <Route path="/people/attendance" element={<Attendance />} />
        <Route path="/hr" element={<HrReview />} />
        <Route path="/reimbursements/hr" element={<Navigate to="/hr" replace />} />

        {/* Expense claims */}
        <Route path="/reimbursements" element={<ReimbursementsList />} />
        <Route path="/reimbursements/pay" element={<Disbursement />} />
        <Route path="/reimbursements/:id" element={<ClaimDetail />} />

        {/* Automation */}
        <Route path="/approvals" element={<ApprovalsInbox />} />
        <Route path="/comms/commitments" element={<CommitmentsList />} />
        <Route path="/comms/escalations" element={<EscalationsBoard />} />
        <Route path="/automations" element={<AutomationsList />} />

        {/* Shared by every department */}
        <Route path="/chat" element={<Chatroom />} />
        <Route path="/chat/join/:code" element={<JoinRoom />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/activity" element={<ActivityFeed />} />

        {/* Anything else goes to this tab's landing page */}
        <Route path="*" element={<Home />} />
      </Routes>
    </AppShell>
  );
};

export default App;
