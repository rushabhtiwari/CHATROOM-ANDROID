import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Paperclip,
  Sparkles,
  PlusCircle,
  FileText,
  UserCheck,
  XCircle,
  Send,
  AlertCircle,
  CheckCircle2,
  Search,
  CornerDownRight,
  Filter,
  ExternalLink,
  ChevronRight,
  Bot
} from 'lucide-react';
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
    setShowToast(`RFQ created successfully from ${selectedEmail.senderCompany}. Routed to Costing queue.`);
    setTimeout(() => {
      setShowToast(null);
      navigate('/rfq/RFQ-2026-0418');
    }, 1200);
  };

  const handleSendDraft = () => {
    setShowToast('Reply draft submitted for Rajesh Kumar (HOD Sales) approval.');
    setIsDraftingReply(false);
    setTimeout(() => setShowToast(null), 3000);
  };

  const matchedCustomer = mockCustomers.find(c => c.id === selectedEmail.matchedCustomerId);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4 animate-fadeIn">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{showToast}</span>
        </div>
      )}

      {/* Top Action & Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-line p-3 rounded-md shadow-card">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-ai-tint border border-ai/20 flex items-center justify-center text-ai">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-display font-semibold text-ink">
              Email Intake Queue & AI Extraction
            </h1>
            <p className="text-xs text-muted">
              AI parses incoming customer RFQs, draws specs, and creates structured work tickets in PACT.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2 py-1 rounded bg-canvas border border-line text-slate-700">
            Extraction Model: <strong className="text-ai">claude-sonnet-4-6</strong>
          </span>
          <span className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-strand-green font-semibold">
            Avg Confidence: 96%
          </span>
        </div>
      </div>

      {/* Three-Pane Workspace */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0 bg-surface border border-line rounded-lg shadow-card overflow-hidden">
        
        {/* Left Pane (3 cols / 280px): Queues & Filters */}
        <div className="col-span-12 md:col-span-3 border-r border-line p-3 flex flex-col justify-between overflow-y-auto bg-canvas/30">
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted font-mono mb-2">
                Processing Queues
              </div>
              <div className="space-y-1">
                {[
                  { id: 'all', label: 'All Inbound Emails', count: 68 },
                  { id: 'Needs review', label: 'Needs Review', count: mockEmailStats.needsReview, alert: true },
                  { id: 'Auto-created', label: 'Auto-created RFQs', count: mockEmailStats.autoCreated },
                  { id: 'Unknown customer', label: 'Unknown Customer', count: mockEmailStats.unknownCustomer, amber: true },
                  { id: 'Duplicates merged', label: 'Duplicates Merged', count: mockEmailStats.duplicatesMerged },
                  { id: 'Not an RFQ', label: 'Not an RFQ', count: mockEmailStats.notAnRfq },
                  { id: 'Failed extraction', label: 'Failed Extraction', count: mockEmailStats.failedExtraction }
                ].map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQueue(q.id)}
                    className={`w-full px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                      selectedQueue === q.id
                        ? 'bg-ink text-white font-medium'
                        : 'hover:bg-slate-200/60 text-slate-700'
                    }`}
                  >
                    <span>{q.label}</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 rounded ${
                        selectedQueue === q.id
                          ? 'bg-white/20 text-white'
                          : q.alert
                          ? 'bg-strand-red text-white font-bold'
                          : q.amber
                          ? 'bg-strand-amber text-white font-bold'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {q.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mailbox Filter */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted font-mono mb-2">
                Mailbox Channels
              </div>
              <div className="space-y-1">
                {[
                  { id: 'all', label: 'All Mailboxes' },
                  { id: 'sales@kiranudyog.com', label: 'sales@kiranudyog.com' },
                  { id: 'dispatch@kiranudyog.com', label: 'dispatch@kiranudyog.com' },
                  { id: 'accounts@kiranudyog.com', label: 'accounts@kiranudyog.com' }
                ].map((mb) => (
                  <button
                    key={mb.id}
                    onClick={() => setSelectedMailbox(mb.id)}
                    className={`w-full px-2 py-1 rounded text-[11px] font-mono text-left truncate transition-colors ${
                      selectedMailbox === mb.id
                        ? 'bg-kiran-tint text-kiran font-semibold border border-kiran/30'
                        : 'hover:bg-canvas text-slate-600'
                    }`}
                  >
                    {mb.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-line text-[11px] text-muted space-y-1">
            <div className="flex items-center justify-between">
              <span>Sync Interval:</span>
              <span className="font-mono text-ink">Real-time Push</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Confidence Floor:</span>
              <span className="font-mono text-ink">85% Gate</span>
            </div>
          </div>
        </div>

        {/* Centre Pane (4 cols / 420px): Email List */}
        <div className="col-span-12 md:col-span-4 border-r border-line flex flex-col overflow-hidden">
          <div className="p-2.5 border-b border-line bg-canvas/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink font-mono uppercase tracking-wider">
              Inbound Messages ({filterEmails.length})
            </span>
            <span className="text-[11px] text-muted">Sorted by Newest</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {filterEmails.map((em) => {
              const isSelected = selectedEmail.id === em.id;

              return (
                <div
                  key={em.id}
                  onClick={() => handleSelectEmail(em)}
                  className={`p-3 cursor-pointer transition-colors relative ${
                    isSelected ? 'bg-kiran-tint/60' : 'hover:bg-canvas'
                  } ${em.isAIProcessed ? 'border-l-[3px] border-ai' : ''}`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-ink truncate">
                        {em.senderName} · <span className="font-normal text-slate-600">{em.senderCompany}</span>
                      </div>
                      <div className="text-[10px] text-muted truncate font-mono">
                        {em.senderEmail}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-muted shrink-0">
                      {formatDateTimeIST(em.receivedAt).split(',')[1]}
                    </span>
                  </div>

                  <div className="text-xs font-medium text-slate-800 line-clamp-1 mb-1">
                    {em.subject}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight mb-2">
                    {em.preview}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 border border-line text-slate-700">
                        {em.intent}
                      </span>
                      {em.attachments && em.attachments.length > 0 && (
                        <span className="text-[10px] text-muted flex items-center gap-0.5">
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

        {/* Right Pane (5 cols): Split Email + AI Extraction Card */}
        <div className="col-span-12 md:col-span-5 flex flex-col overflow-hidden bg-white">
          
          {/* Top Half: Rendered Customer Email */}
          <div className="p-4 border-b border-line overflow-y-auto max-h-[42%] bg-canvas/20 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-semibold text-sm text-ink leading-snug">
                  {selectedEmail.subject}
                </h3>
                <div className="text-xs text-muted mt-0.5">
                  From: <strong>{selectedEmail.senderName}</strong> &lt;{selectedEmail.senderEmail}&gt; ({selectedEmail.senderCompany})
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Received: {formatDateTimeIST(selectedEmail.receivedAt)} · To: {selectedEmail.mailbox}
                </div>
              </div>
              <StatusPill status={selectedEmail.status} />
            </div>

            {/* Attachments Chips */}
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {selectedEmail.attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="px-2 py-1 bg-white border border-line rounded text-[11px] font-mono flex items-center gap-1.5 shadow-2xs hover:border-kiran cursor-pointer"
                  >
                    <Paperclip className="w-3 h-3 text-kiran" />
                    <span className="text-ink">{att.name}</span>
                    <span className="text-muted">({att.size})</span>
                  </div>
                ))}
              </div>
            )}

            {/* Rendered Email Body with dynamic AI highlight */}
            <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans bg-white p-3 rounded border border-line/80">
              {highlightedText ? (
                // Highlight source phrase in violet
                selectedEmail.body.split(highlightedText).map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <mark className="bg-ai-tint text-ai font-semibold px-1 rounded border border-ai/30">
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

          {/* Bottom Half: The Extraction Card */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-between space-y-3 bg-white">
            
            {/* Unknown Customer Banner (if applicable) */}
            {selectedEmail.status === 'Unknown customer' && (
              <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 text-strand-amber shrink-0" />
                  <span>No existing customer account matched for domain</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Assign to Sunita Rao (CRM) or link to an existing client ledger.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Search existing customer ledger..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="px-2 py-1 text-xs bg-white border border-amber-300 rounded flex-1 focus:outline-none"
                  />
                  <button className="px-2 py-1 bg-strand-amber text-white font-medium rounded text-xs hover:bg-amber-600">
                    Link Customer
                  </button>
                </div>
              </div>
            )}

            {/* Customer Credit Snapshot (if customer matched) */}
            {matchedCustomer && (
              <div className="p-2 rounded bg-canvas border border-line flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600">
                  Customer Code: <strong className="text-ink">{matchedCustomer.code}</strong>
                </span>
                <span className="text-slate-600">
                  Available Credit: <strong className="text-strand-green">₹{(matchedCustomer.availableBalance / 100000).toFixed(2)}L</strong>
                </span>
                {matchedCustomer.stopDispatch && (
                  <span className="text-strand-red font-bold animate-pulse">
                    STOP DISPATCH ACTIVE
                  </span>
                )}
              </div>
            )}

            {/* Structured Extraction Form */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-ai" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink font-mono">
                    Structured RFQ Extraction
                  </span>
                </div>
                <span className="text-[10px] text-muted">
                  Hover any field to highlight source text above
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <AIField
                  label="Customer Name"
                  value={selectedEmail.extractedData.customer}
                  confidence={selectedEmail.extractedData.fieldConfidences?.customer}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.customer}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Contact Person"
                  value={selectedEmail.extractedData.contact}
                  confidence={selectedEmail.extractedData.fieldConfidences?.contact}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.contact}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Part Number"
                  value={selectedEmail.extractedData.partNumber}
                  confidence={selectedEmail.extractedData.fieldConfidences?.partNumber}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.partNumber}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Quantity & UOM"
                  value={`${selectedEmail.extractedData.quantity} ${selectedEmail.extractedData.uom}`}
                  confidence={selectedEmail.extractedData.fieldConfidences?.quantity}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.quantity}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Target Price"
                  value={selectedEmail.extractedData.targetPrice}
                  confidence={selectedEmail.extractedData.fieldConfidences?.targetPrice}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.targetPrice}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="SOP Target Date"
                  value={selectedEmail.extractedData.sopDate}
                  confidence={selectedEmail.extractedData.fieldConfidences?.sopDate}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.sopDate}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                />
                <AIField
                  label="Delivery Location"
                  value={selectedEmail.extractedData.deliveryLocation}
                  confidence={selectedEmail.extractedData.fieldConfidences?.deliveryLocation}
                  sourceText={selectedEmail.extractedData.fieldOrigins?.deliveryLocation}
                  onHover={(txt) => setHighlightedText(txt)}
                  onLeave={() => setHighlightedText(undefined)}
                  className="col-span-2"
                />
              </div>
            </div>

            {/* AI Reply Slide-over / Inline Editor */}
            {isDraftingReply && (
              <div className="p-3 rounded-md bg-ai-tint/30 border border-ai/30 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ai flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5" />
                    AI Follow-up Reply (Model: claude-sonnet-4-6)
                  </span>
                  <span className="text-[10px] text-muted font-mono">
                    Requires HOD Approval
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full text-xs font-sans p-2 rounded bg-white border border-ai/30 text-ink focus:outline-none focus:ring-1 focus:ring-ai"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted">
                    Note: Will be routed to Rajesh Kumar's inbox before sending.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsDraftingReply(false)}
                      className="px-2 py-1 text-xs text-slate-600 hover:text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendDraft}
                      className="px-3 py-1 bg-ai text-white rounded text-xs font-semibold hover:bg-ai/90 shadow-xs flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      Send for HOD Approval
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsDraftingReply(!isDraftingReply)}
                  className="px-2.5 py-1.5 rounded bg-ai-tint text-ai hover:bg-ai-tint/80 border border-ai/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Draft Reply
                </button>
                <button
                  onClick={() => setShowToast('Merged into active customer thread.')}
                  className="px-2.5 py-1.5 rounded bg-white hover:bg-canvas border border-line text-xs font-medium text-slate"
                >
                  Merge into RFQ
                </button>
                <button
                  onClick={() => setShowToast('Marked as not an RFQ.')}
                  className="px-2.5 py-1.5 rounded bg-white hover:bg-canvas border border-line text-xs font-medium text-slate"
                >
                  Mark not RFQ
                </button>
              </div>

              <button
                onClick={handleCreateRFQ}
                className="px-4 py-1.5 rounded bg-kiran hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Create RFQ Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
