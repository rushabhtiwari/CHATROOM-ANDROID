import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { mockEmails } from '../../data/emails';
import { ArrowLeft, Paperclip } from 'lucide-react';
import { AIField } from '../../components/common/AIField';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { formatDateTimeIST } from '../../utils/formatters';

export const EmailDetail: React.FC = () => {
  const { emailId } = useParams();
  const navigate = useNavigate();

  const email = mockEmails.find(e => e.id === emailId) || mockEmails[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/email"
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Inbox</span>
        </Link>
        <button onClick={() => navigate('/rfq/RFQ-2026-0418')} className="btn-primary">
          Open RFQ
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 bg-surface border border-line rounded-lg p-5 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={email.status} />
              <ConfidenceChip confidence={email.confidence} />
            </div>
            <h1 className="font-semibold text-[20px] leading-snug text-ink mt-3">{email.subject}</h1>
            <div className="text-[13px] text-muted mt-1.5">
              <span className="text-ink">{email.senderName}</span> &lt;{email.senderEmail}&gt; · {email.senderCompany}
            </div>
            <div className="text-[13px] text-muted">{formatDateTimeIST(email.receivedAt)}</div>
          </div>

          {email.attachments && email.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {email.attachments.map((att, i) => (
                <span
                  key={i}
                  className="h-8 px-2.5 inline-flex items-center gap-1.5 text-[13px] bg-white rounded-md border border-line"
                >
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-ink">{att.name}</span>
                  <span className="text-muted">{att.size}</span>
                </span>
              ))}
            </div>
          )}

          <div className="text-[14px] text-ink-2 whitespace-pre-line leading-relaxed border-t border-line-2 pt-4">
            {email.body}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="bg-surface border border-line rounded-lg p-5 space-y-3">
            <h3 className="text-[16px] font-semibold text-ink">Details</h3>

            <div className="space-y-2">
              <AIField label="Customer" value={email.extractedData.customer} confidence={email.extractedData.fieldConfidences?.customer} />
              <AIField label="Contact" value={email.extractedData.contact} confidence={email.extractedData.fieldConfidences?.contact} />
              <AIField label="Part no." value={email.extractedData.partNumber} confidence={email.extractedData.fieldConfidences?.partNumber} />
              <AIField label="Quantity" value={`${email.extractedData.quantity} ${email.extractedData.uom}`} confidence={email.extractedData.fieldConfidences?.quantity} />
              <AIField label="Target price" value={email.extractedData.targetPrice} confidence={email.extractedData.fieldConfidences?.targetPrice} />
              <AIField label="Specification" value={email.extractedData.specification} confidence={email.extractedData.fieldConfidences?.specification} />
              <AIField label="SOP date" value={email.extractedData.sopDate} confidence={email.extractedData.fieldConfidences?.sopDate} />
              <AIField label="Deliver to" value={email.extractedData.deliveryLocation} confidence={email.extractedData.fieldConfidences?.deliveryLocation} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
