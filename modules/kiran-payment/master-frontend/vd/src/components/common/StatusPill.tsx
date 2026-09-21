import React from 'react';
import { StatusVariant } from '../../types';

interface StatusPillProps {
  status: StatusVariant | string;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, className = '' }) => {
  let dotClass = 'bg-slate-400';
  let bgClass = 'bg-[#EFEFF2] text-[#48484F]';

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
      bgClass = 'bg-[#E7F3EB] text-[#17723F]';
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
      dotClass = 'bg-[#C77700]';
      bgClass = 'bg-[#FBEFDC] text-[#8A4F00]';
      break;

    case 'overdue':
    case 'lost':
    case 'rejected':
    case 'delayed':
    case 'no response - 3 days':
    case 'exception':
    case 'failed':
      dotClass = 'bg-strand-red';
      bgClass = 'bg-[#FBE9E7] text-[#B3302A]';
      break;

    case 'blocked':
    case 'stop dispatch blocked':
      dotClass = 'bg-strand-red';
      bgClass = 'bg-[#FBE9E7] text-[#B3302A]';
      break;

    case 'awaiting approval':
    case 'awaiting hod':
    case 'pending hod':
    case 'needs review':
    case 'pending':
      dotClass = 'bg-kiran';
      bgClass = 'bg-[#E7EFFA] text-[#0B4F9C]';
      break;

    case 'closed':
    case 'draft':
    case 'queued':
      dotClass = 'bg-[#9A9AA2]';
      bgClass = 'bg-[#EFEFF2] text-[#48484F]';
      break;

    default:
      dotClass = 'bg-[#9A9AA2]';
      bgClass = 'bg-[#EFEFF2] text-[#48484F]';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-badge text-[12.5px] font-medium leading-none ${bgClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass} shrink-0`} />
      <span className="whitespace-nowrap">{status}</span>
    </span>
  );
};
