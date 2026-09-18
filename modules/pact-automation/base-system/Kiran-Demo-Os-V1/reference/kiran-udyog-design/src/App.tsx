// Routing table for the RTS demo. Every authenticated-looking screen hangs off the
// AppShell parent route; the catch-all sits outside it so a bad URL cannot fake the chrome.

import { Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AppProvider } from '@/context/AppContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
const AdminOverview = lazy(() => import('@/pages/AdminOverview'));
const MyRequests = lazy(() => import('@/pages/MyRequests'));
const HrPortal = lazy(() => import('@/pages/HrPortal'));
const AccountsPortal = lazy(() => import('@/pages/AccountsPortal'));
const PaymentPortal = lazy(() => import('@/pages/PaymentPortal'));
const DisbursementCheckout = lazy(() => import('@/pages/DisbursementCheckout'));
const PaymentReceipt = lazy(() => import('@/pages/PaymentReceipt'));
const RequestDetail = lazy(() => import('@/pages/RequestDetail'));

/**
 * A bad URL is a filing error, so it is set as one: a sheet torn out of the register,
 * stamped at the head, with the path that was asked for and the code that came back
 * entered as two ruled lines. The notched corner is this page's single signature device.
 */
function NotFound(): JSX.Element {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-canvas px-4 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto w-full max-w-2xl">
        <div className="ku-sheet ku-notch animate-page-in px-6 py-8 sm:px-10 sm:py-10">
          <p className="ku-eyebrow">Kiran Udyog · Receipt &amp; Reimbursement Tracking</p>

          <h1 className="ku-wide mt-3 max-w-xl font-display text-h1 font-semibold text-rich-black">
            This page is not in the register
          </h1>

          <div
            aria-hidden="true"
            className="mt-5 h-[3px] origin-left animate-rule-in bg-darkey-bluey"
          />

          <dl className="ku-ruled mt-5 border-t border-hairline">
            <div className="grid grid-cols-[minmax(84px,26%)_1fr] items-baseline gap-x-4 py-2.5">
              <dt className="ku-eyebrow">Requested</dt>
              <dd className="ku-fig break-all text-body-s text-rich-black">{pathname}</dd>
            </div>
            <div className="grid grid-cols-[minmax(84px,26%)_1fr] items-baseline gap-x-4 py-2.5">
              <dt className="ku-eyebrow">Response</dt>
              <dd className="ku-fig text-body-s text-rich-black">404 · no such record</dd>
            </div>
          </dl>

          <p className="mt-5 max-w-[58ch] text-body-s leading-6 text-meta">
            Either the link has gone stale or the claim it pointed at was filed under a different
            docket. The overview lists everything currently on the books.
          </p>

          <div className="mt-7">
            <Button variant="primary" iconRight={ArrowRight} onClick={() => navigate('/overview')}>
              Go to the overview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppProvider>
        <Suspense fallback={null}>
          <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route element={<AppShell />}>
            <Route path="/overview" element={<AdminOverview />} />
            <Route path="/my-requests" element={<MyRequests />} />
            <Route path="/hr" element={<HrPortal />} />
            <Route path="/accounts" element={<AccountsPortal />} />
            <Route path="/pay" element={<DisbursementCheckout />} />
            <Route path="/payments" element={<PaymentPortal />} />
            <Route path="/requests/:id" element={<RequestDetail />} />
          </Route>
          {/* Standalone: the receipt is its own document, with no app chrome around it. */}
          <Route path="/receipt/:utr" element={<PaymentReceipt />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppProvider>
    </BrowserRouter>
  );
}
