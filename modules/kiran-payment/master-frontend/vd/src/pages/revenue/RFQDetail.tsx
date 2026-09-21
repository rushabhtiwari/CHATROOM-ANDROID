import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { mockRFQs } from '../../data/rfqs';
import { mockCustomers } from '../../data/customers';
import { ArrowLeft, Paperclip, CheckCircle2 } from 'lucide-react';
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
    setToastMessage('Escalated to Rajesh Kumar.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'costing', label: 'Costing' },
    { id: 'quotations', label: 'Quotations', count: rfq.quotations.length },
    { id: 'samples', label: 'Samples', count: rfq.samples.length },
    { id: 'documents', label: 'Documents', count: rfq.documents.length },
    { id: 'activity', label: 'Activity', count: rfq.timeline.length }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover flex items-center gap-2.5 text-[14px] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Link
        to="/rfq"
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>RFQs</span>
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-code font-semibold text-[24px] leading-[1.2] text-ink">{rfq.rfqNumber}</h1>
            <StatusPill status={rfq.status} />
            <AgeIndicator daysInStage={rfq.daysInStage} slaLimitDays={rfq.slaLimitDays} />
          </div>
          <div className="text-[14px] text-ink-2 mt-1.5">
            <span className="font-medium text-ink">{rfq.customerName}</span> · {rfq.partNumber}
          </div>
          <div className="text-[13px] text-muted mt-0.5">
            {rfq.description} · {formatDate(rfq.createdDate)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleEscalate} className="btn-secondary text-strand-red">
            Escalate
          </button>
          <button onClick={handleRequestSample} className="btn-secondary">
            Request sample
          </button>
          <button onClick={handleGenerateQuote} className="btn-primary">
            Create quotation
          </button>
        </div>
      </div>

      {rfq.missingMandatoryFields && rfq.missingMandatoryFields.length > 0 && (
        <div className="px-4 py-3 bg-[#FBE9E7] rounded-lg text-[14px] text-[#B3302A] flex flex-wrap items-center justify-between gap-3">
          <span>
            <span className="font-medium">Missing:</span> {rfq.missingMandatoryFields.join(', ')}
          </span>
          <button onClick={() => setActiveTab('details')} className="btn-secondary">
            Fill in
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface border border-line rounded-lg p-5 space-y-5">
            <PageTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={(tab) => setActiveTab(tab)}
              departmentColor="#B5070E"
            />

            {activeTab === 'details' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[14px]">
                <AIField label="Customer" value={rfq.customerName} />
                <AIField label="Region" value={rfq.region} />
                <AIField label="Part no." value={rfq.partNumber} />
                <AIField label="Quantity" value={`${rfq.quantity.toLocaleString('en-IN')} ${rfq.uom}`} />
                <AIField label="Target price" value={rfq.targetPrice ? formatINR(rfq.targetPrice) : 'Not specified'} />
                <AIField label="SOP date" value={formatDate(rfq.sopDate)} />
                <AIField label="Value" value={formatINR(rfq.estimatedValue)} />
                <AIField label="Owner" value={rfq.ownerName} />
              </div>
            )}

            {activeTab === 'costing' && (
              rfq.costing ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5 text-[14px]">
                  <div>
                    <div className="text-[13px] text-muted">Material</div>
                    <div className="text-ink mt-0.5">{rfq.costing.material}</div>
                  </div>
                  <div>
                    <div className="text-[13px] text-muted">Cut length</div>
                    <div className="text-ink mt-0.5">{rfq.costing.cutLength}</div>
                  </div>
                  <div>
                    <div className="text-[13px] text-muted">Rate</div>
                    <div className="text-ink mt-0.5 tabular-nums">{formatINR(rfq.costing.rate)} / m</div>
                  </div>
                  <div>
                    <div className="text-[13px] text-muted">Margin</div>
                    <div className="text-ink mt-0.5 tabular-nums">{rfq.costing.marginPct}%</div>
                  </div>
                  <div>
                    <div className="text-[13px] text-muted">Labour</div>
                    <div className="text-ink mt-0.5 tabular-nums">₹{rfq.costing.laborCost} / m</div>
                  </div>
                  <div>
                    <div className="text-[13px] text-muted">Packaging</div>
                    <div className="text-ink mt-0.5 tabular-nums">₹{rfq.costing.packagingCost} / m</div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-[14px] text-muted">No costing yet.</div>
              )
            )}

            {activeTab === 'quotations' && (
              <div>
                <div className="flex justify-end mb-1">
                  <button onClick={handleGenerateQuote} className="btn-secondary">
                    New version
                  </button>
                </div>
                {rfq.quotations.length === 0 && (
                  <div className="py-8 text-center text-[14px] text-muted">No quotations yet.</div>
                )}
                <div className="divide-y divide-line-2">
                  {rfq.quotations.map((q, idx) => (
                    <div key={idx} className="py-3.5 flex items-center justify-between gap-3 text-[14px]">
                      <div>
                        <Link
                          to={`/quotations/${q.quoteNumber}`}
                          className="font-code text-[13px] text-kiran hover:underline"
                        >
                          {q.quoteNumber} ({q.version})
                        </Link>
                        <div className="text-[13px] text-muted mt-0.5">
                          {formatDate(q.date)} · <span className="tabular-nums">{formatINR(q.value)}</span>
                        </div>
                      </div>
                      <StatusPill status={q.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'samples' && (
              <div>
                <div className="flex justify-end mb-1">
                  <button onClick={handleRequestSample} className="btn-secondary">
                    Request sample
                  </button>
                </div>
                {rfq.samples.length === 0 && (
                  <div className="py-8 text-center text-[14px] text-muted">No samples yet.</div>
                )}
                <div className="divide-y divide-line-2">
                  {rfq.samples.map((s, idx) => (
                    <div key={idx} className="py-3.5 flex items-center justify-between gap-3 text-[14px]">
                      <div>
                        <Link to="/samples" className="font-code text-[13px] text-kiran hover:underline">
                          {s.sampleNumber}
                        </Link>
                        <div className="text-[13px] text-muted mt-0.5">{formatDate(s.date)}</div>
                      </div>
                      <StatusPill status={s.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="divide-y divide-line-2">
                {rfq.documents.length === 0 && (
                  <div className="py-8 text-center text-[14px] text-muted">No documents yet.</div>
                )}
                {rfq.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="py-3.5 flex items-center justify-between gap-3 text-[14px] hover:bg-canvas cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-ink truncate">{doc.name}</span>
                      <span className="text-[13px] text-muted whitespace-nowrap">{doc.size}</span>
                    </div>
                    <span className="text-[13px] text-muted whitespace-nowrap">{doc.uploadedAt}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'activity' && <Timeline events={rfq.timeline} />}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-surface border border-line rounded-lg p-5 space-y-3 text-[14px]">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-ink">Customer</h3>
              <span className="font-code text-[13px] text-muted">{customer.code}</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted">Credit limit</span>
                <span className="text-ink tabular-nums">{formatINR(customer.creditLimit)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Outstanding</span>
                <span className="text-ink tabular-nums">{formatINR(customer.outstanding)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Available</span>
                <span className="text-ink tabular-nums">{formatINR(customer.availableBalance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Overdue 60+ days</span>
                <span className={`tabular-nums ${customer.overdueAmount > 0 ? 'text-strand-red' : 'text-ink'}`}>
                  {formatINR(customer.overdueAmount)}
                </span>
              </div>
            </div>

            {customer.stopDispatch && (
              <div className="px-3 py-2.5 rounded-md bg-[#FBE9E7] text-[13px] text-[#B3302A]">
                <div className="font-medium">Dispatch stopped</div>
                <div className="mt-0.5">{customer.stopDispatchReason}</div>
              </div>
            )}
          </div>

          <div className="bg-surface border border-line rounded-lg p-5">
            <h3 className="text-[16px] font-semibold text-ink mb-2">Routing</h3>

            <div className="divide-y divide-line-2">
              {rfq.routingHops.map((hop, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3 text-[14px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        hop.isCurrent
                          ? 'bg-kiran'
                          : hop.status === 'completed'
                          ? 'bg-strand-green'
                          : 'bg-slate-300'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className={hop.isCurrent ? 'font-medium text-ink' : 'text-ink-2'}>{hop.department}</div>
                      <div className="text-[13px] text-muted truncate">{hop.owner}</div>
                    </div>
                  </div>
                  <span className="text-[13px] text-muted whitespace-nowrap">{hop.deadline}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-line rounded-lg p-5">
            <h3 className="text-[16px] font-semibold text-ink mb-2">Reminders</h3>
            <div className="divide-y divide-line-2 text-[14px]">
              <div className="py-3 flex items-center justify-between gap-3">
                <span className="text-ink-2">Costing chase</span>
                <span className="text-[13px] text-muted whitespace-nowrap">22 Aug, 10 AM</span>
              </div>
              <div className="py-3 flex items-center justify-between gap-3">
                <span className="text-ink-2">Quote follow-up</span>
                <span className="text-[13px] text-muted whitespace-nowrap">26 Aug, 03 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
