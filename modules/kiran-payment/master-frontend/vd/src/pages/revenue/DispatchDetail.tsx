import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { mockDispatches } from '../../data/dispatches';
import { ArrowLeft } from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { formatDate, formatINR } from '../../utils/formatters';

export const DispatchDetail: React.FC = () => {
  const { id } = useParams();
  const dsp = mockDispatches.find(d => d.id === id) || mockDispatches[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      <Link
        to="/dispatch"
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Dispatch</span>
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-code font-semibold text-[24px] leading-[1.2] text-ink">
            {dsp.dispatchNumber} {dsp.invoiceNumber && `· ${dsp.invoiceNumber}`}
          </h1>
          <StatusPill status={dsp.stage} />
        </div>
        <div className="text-[14px] text-ink-2 mt-1.5">
          <span className="font-medium text-ink">{dsp.customerName}</span> · {dsp.product}
        </div>
        <div className="text-[13px] text-muted mt-0.5">
          {formatDate(dsp.sldDate)} · {dsp.carrier} · {dsp.vehicleNumber}
        </div>
      </div>

      {dsp.stopDispatchBlocked && (
        <div className="px-4 py-3 bg-[#FBE9E7] rounded-lg text-[14px] font-medium text-[#B3302A]">
          On hold — ₹8,42,150 overdue over 60 days
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi">
          <div className="kpi-label">Value</div>
          <div className="kpi-value">{formatINR(dsp.value)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Quantity</div>
          <div className="kpi-value">{dsp.quantity.toLocaleString('en-IN')} {dsp.uom}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Reminders sent</div>
          <div className="kpi-value">{dsp.remindersSent}</div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 gap-5 text-[14px]">
        <div>
          <div className="text-[13px] text-muted">ASN</div>
          <div className="mt-1 flex items-center gap-2 text-ink">
            <span className={dsp.asnNumber ? 'font-code text-[13px]' : ''}>{dsp.asnNumber || 'Not linked'}</span>
            {dsp.asnConfidence && <ConfidenceChip confidence={dsp.asnConfidence} />}
          </div>
        </div>
        <div>
          <div className="text-[13px] text-muted">POD</div>
          <div className="mt-1 text-ink">{dsp.podStatus}</div>
        </div>
      </div>
    </div>
  );
};
