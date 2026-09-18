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
import {
  Truck,
  Plus,
  ShieldAlert,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  Search,
  ExternalLink
} from 'lucide-react';

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
    setToastMessage(`Emergency release request submitted to Meera Iyer (Accounts Head) for ${dsp.customerName}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLinkASN = (dspId: string) => {
    setToastMessage(`ASN auto-linked with 98% confidence from customer logistics webhook.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-strand-amber flex items-center gap-2.5 text-xs animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-strand-amber" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Dispatch Board & Logistics Pipeline"
        actions={
          <button
            onClick={() => setSelectedDispatch(mockDispatches[0])}
            className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Generate SLD
          </button>
        }
      />

      {/* Pipeline Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex items-start gap-4 min-w-[1400px]">
          {stages.map((stage) => {
            const stageItems = dispatches.filter((d) => d.stage === stage);

            return (
              <div
                key={stage}
                className="w-72 bg-surface border border-line rounded-lg shadow-card flex flex-col max-h-[calc(100vh-240px)] shrink-0"
              >
                {/* Stage Header */}
                <div className="p-3 border-b border-line bg-canvas/60 flex items-center justify-between">
                  <span className="font-semibold text-xs text-ink font-mono uppercase tracking-wider">
                    {stage}
                  </span>
                  <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold">
                    {stageItems.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                  {stageItems.length === 0 ? (
                    <div className="py-8 text-center text-muted text-[11px] border border-dashed border-line rounded">
                      No dispatches in {stage}
                    </div>
                  ) : (
                    stageItems.map((dsp) => (
                      <div
                        key={dsp.id}
                        onClick={() => setSelectedDispatch(dsp)}
                        className={`bg-white border rounded p-3 shadow-xs space-y-2 cursor-pointer transition-all hover:shadow-sm ${
                          dsp.stopDispatchBlocked
                            ? 'border-red-300 bg-red-50/20 ring-1 ring-strand-red'
                            : 'border-line hover:border-kiran'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-kiran">
                            {dsp.invoiceNumber || dsp.dispatchNumber}
                          </span>
                          <StatusPill status={dsp.acknowledgementStatus} />
                        </div>

                        <div>
                          <h4 className="font-semibold text-xs text-ink leading-tight">
                            {dsp.customerName}
                          </h4>
                          <div className="font-mono text-[11px] text-slate-600 mt-0.5">
                            {dsp.product}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted font-mono pt-1 border-t border-line/60">
                          <span>{dsp.quantity.toLocaleString('en-IN')}m</span>
                          <span className="text-slate-800 font-semibold">
                            {formatINR(dsp.value)}
                          </span>
                        </div>

                        {/* Vehicle & Carrier */}
                        <div className="flex items-center justify-between pt-1 text-[10px] text-muted font-mono">
                          <span>{dsp.carrier}</span>
                          <span className="font-semibold text-ink">{dsp.vehicleNumber}</span>
                        </div>

                        {/* ASN Confidence Chip (if ASN linked) */}
                        {dsp.asnNumber && (
                          <div className="pt-1.5 border-t border-line/60 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-slate-600 truncate">{dsp.asnNumber}</span>
                            {dsp.asnConfidence && <ConfidenceChip confidence={dsp.asnConfidence} />}
                          </div>
                        )}

                        {/* Stop Dispatch Alert */}
                        {dsp.stopDispatchBlocked && (
                          <div className="p-1.5 bg-red-100/70 border border-red-300 rounded text-[10px] text-strand-red font-bold flex items-center justify-between">
                            <span>STOP DISPATCH HOLD</span>
                            <span>₹{(dsp.overdueAmountCustomer / 100000).toFixed(2)}L Overdue</span>
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

      {/* SLD Inspection / Credit Check Drawer Modal */}
      {selectedDispatch && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-md shadow-popover border border-line max-w-xl w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-kiran" />
                <h3 className="font-display font-semibold text-sm text-ink">
                  SLD & Credit Clearance Inspection — {selectedDispatch.dispatchNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDispatch(null)}
                className="text-xs text-muted hover:text-ink"
              >
                Close
              </button>
            </div>

            {/* Stop Dispatch Hard Banner */}
            {selectedDispatch.stopDispatchBlocked && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-md text-xs text-red-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-strand-red">
                  <ShieldAlert className="w-4 h-4" />
                  Dispatch stopped — overdue ₹8,42,150 beyond 60 days.
                </div>
                <p className="text-[11px] text-red-800">
                  Released only by <strong>Meera Iyer (Accounts Head)</strong> following formal payment confirmation or RTGS receipt.
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => handleRequestRelease(selectedDispatch)}
                    className="px-3 py-1 bg-strand-red text-white font-semibold rounded text-xs hover:bg-red-700 shadow-xs"
                  >
                    Request Release from Accounts Head
                  </button>
                </div>
              </div>
            )}

            {/* Customer Credit Panel */}
            <div className="bg-canvas p-4 rounded border border-line space-y-2 font-mono text-xs">
              <div className="text-[11px] font-sans font-semibold uppercase tracking-wider text-muted border-b border-line pb-1.5">
                Financial Credit Parameters (PACT ERP)
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-muted text-[10px]">Customer: </span>
                  <div className="font-bold text-ink font-sans">{selectedDispatch.customerName}</div>
                </div>
                <div>
                  <span className="text-muted text-[10px]">Credit Limit: </span>
                  <div className="font-semibold text-ink">₹2,50,00,000</div>
                </div>
                <div>
                  <span className="text-muted text-[10px]">Available Credit Balance: </span>
                  <div className="font-semibold text-strand-green">₹85,40,000</div>
                </div>
                <div>
                  <span className="text-muted text-[10px]">Total Outstanding: </span>
                  <div className="font-semibold text-ink">₹1,64,60,000</div>
                </div>
                <div className="col-span-2 pt-1 border-t border-line/60 flex items-center justify-between">
                  <span className="text-muted">Overdue Balance &gt;60d:</span>
                  <span className={`font-bold ${selectedDispatch.overdueAmountCustomer > 0 ? 'text-strand-red' : 'text-strand-green'}`}>
                    {formatINR(selectedDispatch.overdueAmountCustomer)}
                  </span>
                </div>
              </div>
            </div>

            {/* Consignment Details */}
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-700">
                <span>Product:</span>
                <span className="font-semibold text-ink font-sans">{selectedDispatch.product}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Dispatch Quantity:</span>
                <span className="font-semibold">{selectedDispatch.quantity.toLocaleString('en-IN')} {selectedDispatch.uom}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Consignment Value:</span>
                <span className="font-semibold text-ink">{formatINR(selectedDispatch.value)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Allocated Vehicle:</span>
                <span className="font-semibold">{selectedDispatch.vehicleNumber} ({selectedDispatch.carrier})</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-line flex items-center justify-between">
              <Link
                to={`/dispatch/${selectedDispatch.id}`}
                className="text-xs font-semibold text-kiran hover:underline"
              >
                Open Full Dispatch Record &rarr;
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDispatch(null)}
                  className="px-3 py-1.5 bg-canvas hover:bg-slate-200 border border-line text-xs font-medium text-slate rounded"
                >
                  Close
                </button>
                <button
                  disabled={selectedDispatch.stopDispatchBlocked}
                  onClick={() => {
                    setToastMessage(`Invoice & ASN generated for ${selectedDispatch.dispatchNumber}.`);
                    setSelectedDispatch(null);
                  }}
                  className="px-4 py-1.5 bg-kiran hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded shadow-xs"
                >
                  Generate Invoice & Gate Pass
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
