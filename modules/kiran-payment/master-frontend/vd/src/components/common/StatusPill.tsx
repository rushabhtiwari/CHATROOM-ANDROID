import React from 'react';
import { StatusVariant } from '../../types';

interface StatusPillProps {
  status: StatusVariant | string;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, className = '' }) => {
  let dotClass = 'bg-slate-400';
  let bgClass = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (status?.toLowerCase()) {
    case 'on track':
    case 'won':
    case 'accepted':
    case 'delivered':
    case 'acknowledged':
    case 'matched':
    case 'active':
    case 'completed':
    case 'approved':
    case 'posted to pact':
      dotClass = 'bg-strand-green';
      bgClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      break;

    case 'at risk':
    case 'in production':
    case 'under review':
    case 'negotiation':
    case 'under negotiation':
    case 'partially executed':
    case 'sent':
    case 'sld generated':
    case 'asn linked':
    case 'feedback awaited':
    case 'costing':
      dotClass = 'bg-strand-amber';
      bgClass = 'bg-amber-50 text-amber-800 border-amber-200';
      break;

    case 'overdue':
    case 'lost':
    case 'rejected':
    case 'delayed':
    case 'no response - 3 days':
    case 'exception':
    case 'failed':
      dotClass = 'bg-strand-red';
      bgClass = 'bg-red-50 text-red-800 border-red-200';
      break;

    case 'blocked':
    case 'stop dispatch blocked':
      dotClass = 'bg-strand-red animate-pulse';
      bgClass = 'bg-red-50 text-red-900 border-red-300 font-semibold';
      break;

    case 'awaiting approval':
    case 'awaiting hod':
    case 'pending hod':
    case 'needs review':
    case 'pending':
      dotClass = 'bg-ai';
      bgClass = 'bg-ai-tint text-ai border-ai/20';
      break;

    case 'closed':
    case 'draft':
    case 'queued':
      dotClass = 'bg-muted';
      bgClass = 'bg-gray-100 text-muted border-line';
      break;

    default:
      dotClass = 'bg-strand-teal';
      bgClass = 'bg-teal-50 text-teal-800 border-teal-200';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-[3px] rounded-badge text-[10.5px] font-medium leading-none border ${bgClass} ${className}`}
    >
      <span className={`w-[5px] h-[5px] rounded-full ${dotClass} shrink-0`} />
      <span className="whitespace-nowrap">{status}</span>
    </span>
  );
};
