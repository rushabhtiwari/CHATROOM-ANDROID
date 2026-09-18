import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { mockRFQs } from '../../data/rfqs';
import { mockCustomers } from '../../data/customers';
import {
  ArrowLeft,
  FileCheck2,
  PackageCheck,
  UserCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Paperclip,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill';
import { AgeIndicator } from '../../components/common/AgeIndicator';
import { AIField } from '../../components/common/AIField';
import { PageTabs } from '../../components/common/PageTabs';
import { Timeline } from '../../components/common/Timeline';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR, formatDate } from '../../utils/formatters';

export const RFQDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('details');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const rfq = mockRFQs.find(r => r.id === id) || mockRFQs[0];
  const customer = mockCustomers.find(c => c.id === rfq.customerId) || mockCustomers[0];

  const handleGenerateQuote = () => {
    navigate(`/quotations/QTE-2026-0812`);
  };

  const handleRequestSample = () => {
    navigate(`/samples`);
  };

  const handleEscalate = () => {
    setToastMessage(`RFQ escalated to L2 (Rajesh Kumar - HOD Sales). Notification dispatched.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'costing', label: 'Costing & BOM' },
    { id: 'quotations', label: 'Quotations', count: rfq.quotations.length },
    { id: 'samples', label: 'Samples', count: rfq.samples.length },
    { id: 'documents', label: 'Documents', count: rfq.documents.length },
    { id: 'activity', label: 'Activity Timeline', count: rfq.timeline.length }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-strand-amber flex items-center gap-2.5 text-xs animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-strand-amber" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Back to list */}
      <div className="flex items-center justify-between">
        <Link
          to="/rfq"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-kiran"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to RFQs & Tickets</span>
        </Link>
        <span className="text-xs font-mono text-muted">
          Created on {formatDate(rfq.createdDate)}
        </span>
      </div>

      {/* Page Header Split */}
      <div className="bg-surface border border-line rounded-lg p-6 shadow-card flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-semibold text-2xl text-ink font-mono">
              {rfq.rfqNumber}
            </h1>
            <StatusPill status={rfq.status} />
            <AgeIndicator daysInStage={rfq.daysInStage} slaLimitDays={rfq.slaLimitDays} />
          </div>
          <div className="text-sm font-semibold text-slate-800 mt-1">
            {rfq.customerName} · <span className="font-mono text-slate-600 font-normal">{rfq.partNumber}</span>
          </div>
          <p className="text-xs text-muted mt-0.5">{rfq.description}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleEscalate}
            className="px-3 py-1.5 bg-canvas hover:bg-slate-100 border border-line text-xs font-medium text-strand-red rounded transition-colors"
          >
            Escalate SLA
          </button>
          <button
            onClick={handleRequestSample}
            className="px-3 py-1.5 bg-canvas hover:bg-slate-100 border border-line text-xs font-medium text-slate-700 rounded transition-colors"
          >
            Request Sample
          </button>
          <button
            onClick={handleGenerateQuote}
            className="px-4 py-1.5 bg-kiran hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Generate Quotation
          </button>
        </div>
      </div>

      {/* Mandatory Missing Fields Bar (if any) */}
      {rfq.missingMandatoryFields && rfq.missingMandatoryFields.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-strand-red" />
            <span>
              <strong>{rfq.missingMandatoryFields.length} mandatory fields missing:</strong>{' '}
              {rfq.missingMandatoryFields.join(', ')}
            </span>
          </div>
          <button
            onClick={() => setActiveTab('details')}
            className="text-xs font-semibold text-strand-red hover:underline"
          >
            Jump to complete &rarr;
          </button>
        </div>
      )}

      {/* 2/3 + 1/3 Main Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Main Column (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-6">
            
            {/* Tabs */}
            <PageTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={(tab) => setActiveTab(tab)}
              departmentColor="#B5070E"
            />

            {/* Tab 1: Details */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <AIField label="Customer Name" value={rfq.customerName} />
                  <AIField label="Customer Region" value={`${rfq.region} Zone`} />
                  <AIField label="Part Number" value={rfq.partNumber} />
                  <AIField label="Quantity" value={`${rfq.quantity.toLocaleString('en-IN')} ${rfq.uom}`} />
                  <AIField label="Target Price" value={rfq.targetPrice ? formatINR(rfq.targetPrice) : 'Not specified'} />
                  <AIField label="SOP Date" value={formatDate(rfq.sopDate)} />
                  <AIField label="Estimated Total Value" value={formatINR(rfq.estimatedValue)} />
                  <AIField label="Ticket Owner" value={rfq.ownerName} />
                </div>

                <div className="pt-3 border-t border-line text-xs text-slate-500 bg-canvas/40 p-3 rounded">
                  <div className="font-semibold text-ink mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-ai" />
                    Extraction & Modification Audit Note
                  </div>
                  <p>
                    Record created from inbound email via <strong>claude-sonnet-4-6</strong> on {formatDate(rfq.createdDate)}. Part specification validated by <strong>Vikram Shetty</strong> on 18 Aug 2026.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Costing & BOM */}
            {activeTab === 'costing' && (
              <div className="space-y-4">
                <div className="p-4 rounded border border-line bg-canvas/30 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink font-mono">
                    Production Costing Breakdown
                  </h3>
                  {rfq.costing ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="p-2.5 bg-white border border-line rounded">
                        <div className="text-[10px] text-muted uppercase">Raw Material</div>
                        <div className="font-semibold text-ink mt-0.5">{rfq.costing.material}</div>
                      </div>
                      <div className="p-2.5 bg-white border border-line rounded">
                        <div className="text-[10px] text-muted uppercase">Cut Length Packaging</div>
                        <div className="font-semibold text-ink mt-0.5">{rfq.costing.cutLength}</div>
                      </div>
                      <div className="p-2.5 bg-white border border-line rounded">
                        <div className="text-[10px] text-muted uppercase">Calculated Unit Rate</div>
                        <div className="font-bold text-strand-green mt-0.5">{formatINR(rfq.costing.rate)} / m</div>
                      </div>
                      <div className="p-2.5 bg-white border border-line rounded">
                        <div className="text-[10px] text-muted uppercase">Gross Margin</div>
                        <div className="font-bold text-strand-amber mt-0.5">{rfq.costing.marginPct}%</div>
                      </div>
                      <div className="p-2.5 bg-white border border-line rounded">
                        <div className="text-[10px] text-muted uppercase">Labor & Machine Cost</div>
                        <div className="font-semibold text-slate-700 mt-0.5">₹{rfq.costing.laborCost} / m</div>
                      </div>
                      <div className="p-2.5 bg-white border border-line rounded">
                        <div className="text-[10px] text-muted uppercase">Packaging & Spooling</div>
                        <div className="font-semibold text-slate-700 mt-0.5">₹{rfq.costing.packagingCost} / m</div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-muted">
                      Costing has not been locked by Planning yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Quotations */}
            {activeTab === 'quotations' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-ink font-mono uppercase">
                    Linked Commercial Quotations ({rfq.quotations.length})
                  </span>
                  <button
                    onClick={handleGenerateQuote}
                    className="px-2.5 py-1 bg-kiran text-white rounded text-xs font-semibold"
                  >
                    + Create Quote Version
                  </button>
                </div>
                {rfq.quotations.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-line bg-canvas/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <Link
                        to={`/quotations/${q.quoteNumber}`}
                        className="font-mono font-semibold text-kiran hover:underline"
                      >
                        {q.quoteNumber} ({q.version})
                      </Link>
                      <div className="text-[11px] text-muted font-mono mt-0.5">
                        Generated on {formatDate(q.date)} · Value: {formatINR(q.value)}
                      </div>
                    </div>
                    <StatusPill status={q.status} />
                  </div>
                ))}
              </div>
            )}

            {/* Tab 4: Samples */}
            {activeTab === 'samples' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-ink font-mono uppercase">
                    Linked Sample Qualification Requests ({rfq.samples.length})
                  </span>
                  <button
                    onClick={handleRequestSample}
                    className="px-2.5 py-1 bg-white border border-line text-slate-800 rounded text-xs font-medium"
                  >
                    + Request Sample
                  </button>
                </div>
                {rfq.samples.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-line bg-canvas/30 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <Link to="/samples" className="font-semibold text-kiran hover:underline">
                        {s.sampleNumber}
                      </Link>
                      <div className="text-[11px] text-muted mt-0.5">
                        Linked to {rfq.rfqNumber} · Logged {formatDate(s.date)}
                      </div>
                    </div>
                    <StatusPill status={s.status} />
                  </div>
                ))}
              </div>
            )}

            {/* Tab 5: Documents */}
            {activeTab === 'documents' && (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-ink font-mono uppercase">
                  Technical Drawings & Client Specifications ({rfq.documents.length})
                </span>
                {rfq.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-line bg-white flex items-center justify-between text-xs font-mono shadow-2xs hover:border-kiran cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-kiran" />
                      <span className="font-semibold text-ink">{doc.name}</span>
                      <span className="text-muted">({doc.size})</span>
                    </div>
                    <span className="text-[10px] text-muted">{doc.uploadedAt}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 6: Activity Timeline */}
            {activeTab === 'activity' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink font-mono mb-2">
                  Complete Department & AI Execution Log
                </h3>
                <Timeline events={rfq.timeline} />
              </div>
            )}
          </div>
        </div>

        {/* Right Rail (4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          
          {/* Customer Financial & Credit Card */}
          <div className="bg-surface border border-line rounded-lg p-4 shadow-card space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="font-semibold text-ink uppercase tracking-wider text-[11px]">
                Customer Account Card
              </span>
              <span className="text-kiran text-[11px] font-sans font-medium">{customer.code}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted">Credit Limit:</span>
                <span className="font-semibold text-ink">{formatINR(customer.creditLimit)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Total Outstanding:</span>
                <span className="font-semibold text-ink">{formatINR(customer.outstanding)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Available Balance:</span>
                <span className="font-semibold text-strand-green">{formatINR(customer.availableBalance)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-line/60">
                <span className="text-muted">Overdue &gt;60d:</span>
                <span className={`font-bold ${customer.overdueAmount > 0 ? 'text-strand-red animate-pulse' : 'text-strand-green'}`}>
                  {formatINR(customer.overdueAmount)}
                </span>
              </div>
            </div>

            {customer.stopDispatch && (
              <div className="p-2.5 rounded bg-red-50 border border-red-300 text-[11px] text-red-900 font-sans space-y-1">
                <div className="font-bold flex items-center gap-1 text-strand-red">
                  <ShieldAlert className="w-3.5 h-3.5" /> STOP DISPATCH ACTIVE
                </div>
                <p>{customer.stopDispatchReason}</p>
              </div>
            )}
          </div>

          {/* Department Routing Chain */}
          <div className="bg-surface border border-line rounded-lg p-4 shadow-card space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="font-semibold text-ink uppercase tracking-wider text-[11px] font-mono">
                Department Routing Chain
              </span>
              <span className="text-[10px] text-muted">Hop deadlines</span>
            </div>

            <div className="space-y-3">
              {rfq.routingHops.map((hop, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded border transition-colors ${
                    hop.isCurrent
                      ? 'bg-kiran-tint/60 border-kiran text-kiran font-medium'
                      : hop.status === 'completed'
                      ? 'bg-emerald-50/40 border-emerald-200 text-slate-700'
                      : 'bg-canvas border-line text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      {hop.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-strand-green" />}
                      {hop.department}
                    </span>
                    <span className="font-mono text-[10px]">{hop.deadline}</span>
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    Assignee: <strong>{hop.owner}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Linked Sales Orders & Reminders */}
          <div className="bg-surface border border-line rounded-lg p-4 shadow-card space-y-2 text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted font-mono border-b border-line pb-2">
              Scheduled AI Reminders
            </div>
            <div className="space-y-2 text-[11px] text-slate-700">
              <div className="flex items-center justify-between font-mono bg-canvas p-2 rounded">
                <span>Planning costing auto-chase</span>
                <span className="text-strand-amber">22 Aug, 10 AM</span>
              </div>
              <div className="flex items-center justify-between font-mono bg-canvas p-2 rounded">
                <span>Customer quote follow-up #1</span>
                <span className="text-muted">26 Aug, 03 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
