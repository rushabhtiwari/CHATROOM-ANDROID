import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockDispatches } from '../../data/dispatches';
import { mockCustomers } from '../../data/customers';
import { DispatchItem } from '../../types';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatDate, formatINR } from '../../utils/formatters';
import { Plus, CheckCircle2, X } from 'lucide-react';

export const DispatchBoard: React.FC = () => {
  const navigate = useNavigate();
  const [dispatches, setDispatches] = useState<DispatchItem[]>(mockDispatches);
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const stages: DispatchItem['stage'][] = [
    'SLD generated',
    'Invoice raised',
    'ASN linked',
    'Dispatched',
    'POD/GRN pending',
    'Closed'
  ];

  const handleRequestRelease = (dsp: DispatchItem) => {
    setToastMessage(`Release requested for ${dsp.customerName}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLinkASN = (dspId: string) => {
    setToastMessage('ASN linked.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover flex items-center gap-2.5 text-[14px] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Dispatch"
        actions={
          <button onClick={() => setSelectedDispatch(mockDispatches[0])} className="btn-primary">
            <Plus className="w-4 h-4" />
            New dispatch
          </button>
        }
      />

      <div className="overflow-x-auto pb-4">
        <div className="flex items-start gap-4 min-w-[1400px]">
          {stages.map((stage) => {
            const stageItems = dispatches.filter((d) => d.stage === stage);

            return (
              <div key={stage} className="w-72 flex flex-col max-h-[calc(100vh-240px)] shrink-0">
                <div className="px-1 pb-3 flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{stage}</span>
                  <span className="text-[13px] text-muted tabular-nums">{stageItems.length}</span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1">
                  {stageItems.length === 0 ? (
                    <div className="py-8 text-center text-muted text-[13px] border border-dashed border-line rounded-lg">
                      Empty
                    </div>
                  ) : (
                    stageItems.map((dsp) => (
                      <div
                        key={dsp.id}
                        onClick={() => setSelectedDispatch(dsp)}
                        className="bg-surface border border-line hover:border-slate-300 rounded-lg p-4 space-y-3 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-code text-[13px] text-kiran whitespace-nowrap">
                            {dsp.invoiceNumber || dsp.dispatchNumber}
                          </span>
                          <StatusPill status={dsp.acknowledgementStatus} />
                        </div>

                        <div>
                          <h4 className="font-medium text-[14px] text-ink leading-tight">
                            {dsp.customerName}
                          </h4>
                          <div className="text-[13px] text-muted mt-0.5">{dsp.product}</div>
                        </div>

                        <div className="flex items-center justify-between text-[13px] text-muted">
                          <span className="tabular-nums">{dsp.quantity.toLocaleString('en-IN')}m</span>
                          <span className="text-ink tabular-nums">{formatINR(dsp.value)}</span>
                        </div>

                        <div className="flex items-center justify-between text-[13px] text-muted">
                          <span>{dsp.carrier}</span>
                          <span className="whitespace-nowrap">{dsp.vehicleNumber}</span>
                        </div>

                        {dsp.asnNumber && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-code text-[13px] text-muted truncate">{dsp.asnNumber}</span>
                            {dsp.asnConfidence && <ConfidenceChip confidence={dsp.asnConfidence} />}
                          </div>
                        )}

                        {dsp.stopDispatchBlocked && (
                          <div className="px-2.5 py-1.5 bg-[#FBE9E7] text-[#B3302A] rounded-md text-[13px] font-medium flex items-center justify-between">
                            <span>On hold</span>
                            <span className="tabular-nums">₹{(dsp.overdueAmountCustomer / 100000).toFixed(2)}L overdue</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDispatch && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-modal border border-line max-w-xl w-full p-6 space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-ink">
                Dispatch <span className="font-code text-[14px] font-medium">{selectedDispatch.dispatchNumber}</span>
              </h3>
              <button onClick={() => setSelectedDispatch(null)} className="btn-icon" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedDispatch.stopDispatchBlocked && (
              <div className="p-4 bg-[#FBE9E7] rounded-lg flex flex-wrap items-center justify-between gap-3">
                <div className="text-[14px] font-medium text-[#B3302A]">
                  On hold — ₹8,42,150 overdue over 60 days
                </div>
                <button
                  onClick={() => handleRequestRelease(selectedDispatch)}
                  className="btn-secondary"
                >
                  Request release
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
              <div className="col-span-2">
                <div className="text-[13px] text-muted">Customer</div>
                <div className="font-medium text-ink">{selectedDispatch.customerName}</div>
              </div>
              <div>
                <div className="text-[13px] text-muted">Credit limit</div>
                <div className="text-ink tabular-nums">₹2,50,00,000</div>
              </div>
              <div>
                <div className="text-[13px] text-muted">Available</div>
                <div className="text-ink tabular-nums">₹85,40,000</div>
              </div>
              <div>
                <div className="text-[13px] text-muted">Outstanding</div>
                <div className="text-ink tabular-nums">₹1,64,60,000</div>
              </div>
              <div>
                <div className="text-[13px] text-muted">Overdue 60+ days</div>
                <div className={`tabular-nums ${selectedDispatch.overdueAmountCustomer > 0 ? 'text-strand-red' : 'text-ink'}`}>
                  {formatINR(selectedDispatch.overdueAmountCustomer)}
                </div>
              </div>
            </div>

            <div className="border-t border-line-2 pt-4 space-y-2.5 text-[14px]">
              <div className="flex justify-between gap-4">
                <span className="text-muted">Product</span>
                <span className="text-ink text-right">{selectedDispatch.product}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted">Quantity</span>
                <span className="text-ink tabular-nums">{selectedDispatch.quantity.toLocaleString('en-IN')} {selectedDispatch.uom}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted">Value</span>
                <span className="text-ink tabular-nums">{formatINR(selectedDispatch.value)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted">Vehicle</span>
                <span className="text-ink">{selectedDispatch.vehicleNumber} · {selectedDispatch.carrier}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Link to={`/dispatch/${selectedDispatch.id}`} className="btn-secondary">
                Open record
              </Link>
              <button
                disabled={selectedDispatch.stopDispatchBlocked}
                onClick={() => {
                  setToastMessage(`Invoice created for ${selectedDispatch.dispatchNumber}.`);
                  setSelectedDispatch(null);
                }}
                className="btn-primary"
              >
                Create invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
