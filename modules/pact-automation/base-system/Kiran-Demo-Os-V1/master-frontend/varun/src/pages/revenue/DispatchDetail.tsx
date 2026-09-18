import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockDispatches } from '../../data/dispatches';
import {
  ArrowLeft,
  Truck,
  FileCheck,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Sparkles,
  Paperclip
} from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatDate, formatINR } from '../../utils/formatters';

export const DispatchDetail: React.FC = () => {
  const { id } = useParams();
  const dsp = mockDispatches.find(d => d.id === id) || mockDispatches[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/dispatch"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-kiran"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dispatch Board</span>
        </Link>
        <StatusPill status={dsp.stage} />
      </div>

      {/* Main Card */}
      <div className="bg-surface border border-line rounded-lg p-6 shadow-card space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <h1 className="font-display font-semibold text-2xl text-ink font-mono">
              {dsp.dispatchNumber} {dsp.invoiceNumber && `· ${dsp.invoiceNumber}`}
            </h1>
            <div className="text-sm font-semibold text-slate-800 mt-1">
              {dsp.customerName} · {dsp.product}
            </div>
            <div className="text-xs text-muted font-mono mt-0.5">
              SLD Date: {formatDate(dsp.sldDate)} · Carrier: {dsp.carrier} ({dsp.vehicleNumber})
            </div>
          </div>

          <div className="text-right font-mono">
            <div className="text-[10px] text-muted uppercase">Consignment Value</div>
            <div className="text-xl font-bold text-ink">{formatINR(dsp.value)}</div>
            <div className="text-xs text-slate-600">{dsp.quantity.toLocaleString('en-IN')} {dsp.uom}</div>
          </div>
        </div>

        {dsp.stopDispatchBlocked && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-md text-xs text-red-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-strand-red">
              <ShieldAlert className="w-4 h-4" />
              Dispatch Locked — Customer overdue ₹8,42,150 beyond 60 days
            </div>
            <p className="text-[11px]">
              Gate pass generation suspended until formal release by Meera Iyer (Accounts Head).
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 bg-canvas rounded border border-line">
            <div className="text-[10px] text-muted uppercase">ASN Status</div>
            <div className="font-semibold text-ink mt-1 flex items-center gap-1.5">
              <span>{dsp.asnNumber || 'Pending Link'}</span>
              {dsp.asnConfidence && <ConfidenceChip confidence={dsp.asnConfidence} />}
            </div>
          </div>
          <div className="p-3 bg-canvas rounded border border-line">
            <div className="text-[10px] text-muted uppercase">POD Status</div>
            <div className="font-semibold text-ink mt-1">{dsp.podStatus}</div>
          </div>
          <div className="p-3 bg-canvas rounded border border-line">
            <div className="text-[10px] text-muted uppercase">Chaser Reminders Sent</div>
            <div className="font-semibold text-ink mt-1">{dsp.remindersSent} Auto-Mails</div>
          </div>
        </div>
      </div>
    </div>
  );
};
