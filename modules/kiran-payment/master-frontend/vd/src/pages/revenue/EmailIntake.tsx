import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paperclip, Plus, Send, CheckCircle2 } from 'lucide-react';
import { mockEmails, mockEmailStats } from '../../data/emails';
import { mockCustomers } from '../../data/customers';
import { EmailIntakeItem } from '../../types';
import { AIField } from '../../components/common/AIField';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { StatusPill } from '../../components/common/StatusPill';
import { formatDateTimeIST } from '../../utils/formatters';

export const EmailIntake: React.FC = () => {
  const navigate = useNavigate();
  const [selectedQueue, setSelectedQueue] = useState<string>('all');
  const [selectedMailbox, setSelectedMailbox] = useState<string>('all');
  const [selectedEmail, setSelectedEmail] = useState<EmailIntakeItem>(mockEmails[0]);
  const [highlightedText, setHighlightedText] = useState<string | undefined>();
  const [isDraftingReply, setIsDraftingReply] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>(mockEmails[0].replyDraft?.body || '');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [showToast, setShowToast] = useState<string | null>(null);

  const filterEmails = mockEmails.filter((em) => {
    if (selectedQueue === 'Needs review' && em.status !== 'Needs review') return false;
    if (selectedQueue === 'Auto-created' && em.status !== 'Auto-created') return false;
    if (selectedQueue === 'Unknown customer' && em.status !== 'Unknown customer') return false;
    if (selectedMailbox !== 'all' && em.mailbox !== selectedMailbox) return false;
    return true;
  });

  const handleSelectEmail = (em: EmailIntakeItem) => {
    setSelectedEmail(em);
    setReplyText(em.replyDraft?.body || '');
    setIsDraftingReply(false);
  };

  const handleCreateRFQ = () => {
    setShowToast(`RFQ created for ${selectedEmail.senderCompany}.`);
    setTimeout(() => {
      setShowToast(null);
      navigate('/rfq/RFQ-2026-0418');
    }, 1200);
  };

  const handleSendDraft = () => {
    setShowToast('Reply sent for approval.');
    setIsDraftingReply(false);
    setTimeout(() => setShowToast(null), 3000);
  };

  const matchedCustomer = mockCustomers.find(c => c.id === selectedEmail.matchedCustomerId);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-6 animate-fadeIn">
      {showToast && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover flex items-center gap-2.5 text-[14px] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{showToast}</span>
        </div>
      )}

      <div className="flex items-center min-h-[44px]">
        <h1 className="font-semibold text-[26px] leading-[1.2] text-ink tracking-[-0.02em]">Inbox</h1>
      </div>

      <div className="flex-1 grid grid-cols-12 min-h-0 bg-surface border border-line rounded-lg overflow-hidden">
        {/* Queues */}
        <div className="col-span-12 md:col-span-3 border-r border-line p-4 overflow-y-auto space-y-6">
          <div className="space-y-0.5">
            {[
              { id: 'all', label: 'All', count: 68 },
              { id: 'Needs review', label: 'Needs review', count: mockEmailStats.needsReview, alert: true },
              { id: 'Auto-created', label: 'Auto-created', count: mockEmailStats.autoCreated },
              { id: 'Unknown customer', label: 'Unknown customer', count: mockEmailStats.unknownCustomer },
              { id: 'Duplicates merged', label: 'Duplicates', count: mockEmailStats.duplicatesMerged },
              { id: 'Not an RFQ', label: 'Not an RFQ', count: mockEmailStats.notAnRfq },
              { id: 'Failed extraction', label: 'Failed', count: mockEmailStats.failedExtraction }
            ].map((q) => (
              <button
                key={q.id}
                onClick={() => setSelectedQueue(q.id)}
                className={`w-full h-9 px-3 rounded-md text-[14px] font-medium flex items-center justify-between transition-colors ${
                  selectedQueue === q.id
                    ? 'bg-kiran-tint text-[#0B4F9C]'
                    : 'text-ink-2 hover:bg-black/5'
                }`}
              >
                <span>{q.label}</span>
                <span
                  className={`text-[13px] tabular-nums ${
                    q.alert && q.count > 0 ? 'text-strand-red' : 'text-muted'
                  }`}
                >
                  {q.count}
                </span>
              </button>
            ))}
          </div>

          <div>
            <div className="px-3 mb-1 text-[13px] font-medium text-muted">Mailbox</div>
            <div className="space-y-0.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'sales@kiranudyog.com', label: 'sales@kiranudyog.com' },
                { id: 'dispatch@kiranudyog.com', label: 'dispatch@kiranudyog.com' },
                { id: 'accounts@kiranudyog.com', label: 'accounts@kiranudyog.com' }
              ].map((mb) => (
                <button
                  key={mb.id}
                  onClick={() => setSelectedMailbox(mb.id)}
                  className={`w-full h-9 px-3 rounded-md text-[13px] text-left truncate transition-colors ${
                    selectedMailbox === mb.id
                      ? 'bg-kiran-tint text-[#0B4F9C] font-medium'
                      : 'text-ink-2 hover:bg-black/5'
                  }`}
                >
                  {mb.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Email list */}
        <div className="col-span-12 md:col-span-4 border-r border-line flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {filterEmails.length === 0 && (
              <div className="p-8 text-center text-[14px] text-muted">No emails here.</div>
            )}
            {filterEmails.map((em) => {
              const isSelected = selectedEmail.id === em.id;

              return (
                <div
                  key={em.id}
                  onClick={() => handleSelectEmail(em)}
                  className={`px-4 py-3.5 cursor-pointer transition-colors border-b border-line-2 ${
                    isSelected ? 'bg-kiran-tint' : 'hover:bg-canvas'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 text-[14px] font-medium text-ink truncate">
                      {em.senderName} <span className="font-normal text-muted">· {em.senderCompany}</span>
                    </div>
                    <span className="text-[12px] text-muted shrink-0 whitespace-nowrap">
                      {formatDateTimeIST(em.receivedAt).split(',')[1]}
                    </span>
                  </div>

                  <div className="text-[14px] text-ink-2 line-clamp-1 mt-0.5">{em.subject}</div>
                  <p className="text-[13px] text-muted line-clamp-1 mt-0.5">{em.preview}</p>

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-2 text-[12px] text-muted">
                      <span>{em.intent}</span>
                      {em.attachments && em.attachments.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Paperclip className="w-3 h-3" />
                          {em.attachments.length}
                        </span>
                      )}
                    </div>
                    <ConfidenceChip confidence={em.confidence} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected email */}
        <div className="col-span-12 md:col-span-5 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-line overflow-y-auto max-h-[42%] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-ink leading-snug">
                  {selectedEmail.subject}
                </h3>
                <div className="text-[13px] text-muted mt-1">
                  {selectedEmail.senderName} &lt;{selectedEmail.senderEmail}&gt; · {selectedEmail.senderCompany}
                </div>
                <div className="text-[13px] text-muted">
                  {formatDateTimeIST(selectedEmail.receivedAt)} · {selectedEmail.mailbox}
                </div>
              </div>
              <StatusPill status={selectedEmail.status} />
            </div>

            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedEmail.attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="h-8 px-2.5 bg-white border border-line rounded-md text-[13px] flex items-center gap-1.5 hover:bg-canvas cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-ink">{att.name}</span>
                    <span className="text-muted">{att.size}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[14px] text-ink-2 whitespace-pre-line leading-relaxed">
              {highlightedText ? (
                selectedEmail.body.split(highlightedText).map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <mark className="bg-kiran-tint text-[#0B4F9C] px-0.5 rounded">
                        {highlightedText}
                      </mark>
                    )}
                  </React.Fragment>
                ))
              ) : (
                selectedEmail.body
              )}
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto flex flex-col justify-between space-y-4">
            {selectedEmail.status === 'Unknown customer' && (
              <div className="space-y-2">
                <div className="text-[13px] font-medium text-[#8A4F00]">Customer not found</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search customers"
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="field flex-1"
                  />
                  <button className="btn-secondary">Link</button>
                </div>
              </div>
            )}

            {matchedCustomer && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-muted">
                <span>
                  Code <span className="font-code text-ink">{matchedCustomer.code}</span>
                </span>
                <span>
                  Credit{' '}
                  <span className="text-ink tabular-nums">
                    ₹{(matchedCustomer.availableBalance / 100000).toFixed(2)}L
                  </span>
                </span>
                {matchedCustomer.stopDispatch && (
                  <span className="px-2 h-6 inline-flex items-center rounded-md bg-[#FBE9E7] text-[#B3302A] font-medium">
                    Dispatch stopped
                  </span>
                )}
              </div>
            )}

            <div>
              <h3 className="text-[16px] font-semibold text-ink mb-3">Details</h3>

              <div className="grid grid-cols-2 gap-2 text-[14px]">
                <AIField
                  label="Customer"
                  value={selectedEmail.extractedData.customer}
                  confidence={selectedEmail.extractedData.fieldConfidences?.customer}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.customer}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Contact"
                  value={selectedEmail.extractedData.contact}
                  confidence={selectedEmail.extractedData.fieldConfidences?.contact}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.contact}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Part no."
                  value={selectedEmail.extractedData.partNumber}
                  confidence={selectedEmail.extractedData.fieldConfidences?.partNumber}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.partNumber}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Quantity"
                  value={`${selectedEmail.extractedData.quantity} ${selectedEmail.extractedData.uom}`}
                  confidence={selectedEmail.extractedData.fieldConfidences?.quantity}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.quantity}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Target price"
                  value={selectedEmail.extractedData.targetPrice}
                  confidence={selectedEmail.extractedData.fieldConfidences?.targetPrice}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.targetPrice}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="SOP date"
                  value={selectedEmail.extractedData.sopDate}
                  confidence={selectedEmail.extractedData.fieldConfidences?.sopDate}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.sopDate}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Deliver to"
                  value={selectedEmail.extractedData.deliveryLocation}
                  confidence={selectedEmail.extractedData.fieldConfidences?.deliveryLocation}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.deliveryLocation}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                  className="col-span-2"
                />
              </div>
            </div>

            {isDraftingReply && (
              <div className="space-y-2 animate-fadeIn">
                <div className="text-[13px] font-medium text-muted">Reply</div>
                <textarea
                  rows={4}
                  aria-label="Reply"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="field h-auto py-2"
                />
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setIsDraftingReply(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button onClick={handleSendDraft} className="btn-secondary">
                    <Send className="w-4 h-4 text-slate-500" />
                    Send for approval
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setIsDraftingReply(!isDraftingReply)} className="btn-secondary">
                  Reply
                </button>
                <button
                  onClick={() => setShowToast('Merged into existing RFQ.')}
                  className="btn-secondary"
                >
                  Merge
                </button>
                <button
                  onClick={() => setShowToast('Marked as not an RFQ.')}
                  className="btn-secondary"
                >
                  Not an RFQ
                </button>
              </div>

              <button onClick={handleCreateRFQ} className="btn-primary">
                <Plus className="w-4 h-4" />
                Create RFQ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
