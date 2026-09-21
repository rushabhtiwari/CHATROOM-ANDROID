import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { mockEmails } from '../../data/emails';
import { ArrowLeft, Mail, Paperclip, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
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
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/email"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-kiran"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inbound Email Intake Queue</span>
        </Link>
        <div className="flex items-center gap-2">
          <StatusPill status={email.status} />
          <ConfidenceChip confidence={email.confidence} />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Email Content (7 cols) */}
        <div className="col-span-12 lg:col-span-7 bg-surface border border-line rounded-lg p-6 shadow-card space-y-4">
          <div className="border-b border-line pb-4">
            <h1 className="font-display font-semibold text-xl text-ink">
              {email.subject}
            </h1>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted mt-2 font-mono">
              <div>From: <strong className="text-ink">{email.senderName}</strong> &lt;{email.senderEmail}&gt;</div>
              <div>Company: <strong className="text-ink">{email.senderCompany}</strong></div>
              <div>Date: {formatDateTimeIST(email.receivedAt)}</div>
            </div>
          </div>

          {email.attachments && email.attachments.length > 0 && (
            <div className="p-3 bg-canvas border border-line rounded flex flex-wrap gap-2">
              <span className="text-xs font-semibold text-muted flex items-center gap-1 font-mono">
                <Paperclip className="w-3.5 h-3.5" /> Attachments:
              </span>
              {email.attachments.map((att, i) => (
                <span key={i} className="text-xs font-mono bg-white px-2 py-1 rounded border border-line">
                  {att.name} ({att.size})
                </span>
              ))}
            </div>
          )}

          <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed bg-canvas/30 p-4 rounded border border-line">
            {email.body}
          </div>
        </div>

        {/* Extraction Card & Right Rail (5 cols) */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="bg-surface border border-ai/30 rounded-md p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-xs font-semibold text-ai font-mono flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> AI Field Extractions
              </span>
              <span className="text-[12px] font-mono text-muted">Model: claude-sonnet-4-6</span>
            </div>

            <div className="space-y-2">
              <AIField label="Customer" value={email.extractedData.customer} confidence={email.extractedData.fieldConfidences?.customer} />
              <AIField label="Contact" value={email.extractedData.contact} confidence={email.extractedData.fieldConfidences?.contact} />
              <AIField label="Part Number" value={email.extractedData.partNumber} confidence={email.extractedData.fieldConfidences?.partNumber} />
              <AIField label="Quantity" value={`${email.extractedData.quantity} ${email.extractedData.uom}`} confidence={email.extractedData.fieldConfidences?.quantity} />
              <AIField label="Target Price" value={email.extractedData.targetPrice} confidence={email.extractedData.fieldConfidences?.targetPrice} />
              <AIField label="Specification" value={email.extractedData.specification} confidence={email.extractedData.fieldConfidences?.specification} />
              <AIField label="SOP Date" value={email.extractedData.sopDate} confidence={email.extractedData.fieldConfidences?.sopDate} />
              <AIField label="Delivery Location" value={email.extractedData.deliveryLocation} confidence={email.extractedData.fieldConfidences?.deliveryLocation} />
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('/rfq/RFQ-2026-0418')}
                className="w-full py-2 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View Linked RFQ Ticket (RFQ-2026-0418)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
