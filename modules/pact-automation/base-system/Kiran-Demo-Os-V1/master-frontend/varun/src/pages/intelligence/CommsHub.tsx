import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { mockChannels } from '../../data/comms';
import { CommsChannel, CommsMessage } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import {
  MessagesSquare,
  Sparkles,
  Clock,
  Send,
  CheckCircle2,
  FileText,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Bot
} from 'lucide-react';

export const CommsHub: React.FC = () => {
  const [selectedChannel, setSelectedChannel] = useState<CommsChannel>(mockChannels[0]);
  const [messages, setMessages] = useState<CommsMessage[]>(mockChannels[0].messages);
  const [inputMessage, setInputMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSelectChannel = (ch: CommsChannel) => {
    setSelectedChannel(ch);
    setMessages(ch.messages);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: CommsMessage = {
      id: `MSG-${Date.now()}`,
      senderName: 'Rajesh Kumar',
      senderAvatar: 'RK',
      timestamp: 'Just now',
      content: inputMessage,
      detectedCommitment: inputMessage.toLowerCase().includes('will') || inputMessage.toLowerCase().includes('promise')
        ? {
            person: 'Rajesh Kumar',
            promise: inputMessage,
            dueDate: '22 Aug 2026',
            isReminderSet: true
          }
        : undefined
    };

    setMessages([...messages, newMsg]);
    setInputMessage('');

    if (newMsg.detectedCommitment) {
      setToastMessage('AI Commitment Detector logged commitment and scheduled reminder for 22 Aug.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-ai flex items-center gap-2.5 text-xs animate-fadeIn">
          <Sparkles className="w-4 h-4 text-ai" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Work-Anchored Communications Hub"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/comms/commitments"
              className="px-3 py-1.5 bg-canvas hover:bg-slate-100 border border-line text-xs font-semibold text-slate-800 rounded flex items-center gap-1.5 shadow-2xs"
            >
              <Clock className="w-3.5 h-3.5 text-ai" />
              Tracked Commitments (4)
            </Link>
            <Link
              to="/comms/escalations"
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-semibold text-strand-red rounded flex items-center gap-1.5 shadow-2xs"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Escalation Matrix (3)
            </Link>
          </div>
        }
      />

      {/* Three-Pane Comms Hub */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0 bg-surface border border-line rounded-lg shadow-card overflow-hidden">
        
        {/* Left Pane (3 cols): Channels List */}
        <div className="col-span-12 md:col-span-3 border-r border-line p-3 overflow-y-auto bg-canvas/30 space-y-4">
          <div>
            <div className="text-[12px] font-semibold text-muted font-mono mb-2 px-2">
              Customer & Order Channels
            </div>
            <div className="space-y-1">
              {mockChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChannel(ch)}
                  className={`w-full px-2.5 py-2 rounded text-xs flex items-center justify-between transition-colors text-left ${
                    selectedChannel.id === ch.id
                      ? 'bg-ink text-white font-semibold'
                      : 'hover:bg-slate-200/60 text-slate-700'
                  }`}
                >
                  <div className="truncate pr-1">
                    <div>{ch.name}</div>
                    <div className={`text-[12px] font-mono capitalize ${selectedChannel.id === ch.id ? 'text-slate-300' : 'text-muted'}`}>
                      {ch.type} stream
                    </div>
                  </div>
                  {ch.badgeCount && (
                    <span className="font-mono text-[12px] px-1.5 py-0.2 rounded bg-strand-teal text-white font-semibold shrink-0">
                      {ch.badgeCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Pane (6 cols): Thread Messages & Commitment Underlines */}
        <div className="col-span-12 md:col-span-6 border-r border-line flex flex-col overflow-hidden bg-white">
          {/* Thread Header */}
          <div className="p-3 border-b border-line bg-canvas/40 flex items-center justify-between text-xs font-mono">
            <span className="font-semibold text-ink ">{selectedChannel.name}</span>
            <span className="text-ai flex items-center gap-1 font-sans font-medium">
              <Bot className="w-3.5 h-3.5" /> AI Commitment Listening Active
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-ink text-white font-mono text-[12px] flex items-center justify-center font-bold">
                      {msg.senderAvatar}
                    </div>
                    <span className="font-semibold text-ink">{msg.senderName}</span>
                  </div>
                  <span className="font-mono text-[12px] text-muted">{msg.timestamp}</span>
                </div>

                <div className="pl-8 text-xs text-slate-800 leading-relaxed font-sans">
                  {msg.content}
                </div>

                {/* Referenced Record Tag */}
                {msg.referencedRecord && (
                  <div className="ml-8 p-2 rounded bg-canvas border border-line text-xs font-mono flex items-center justify-between">
                    <span className="text-kiran font-semibold">{msg.referencedRecord.title}</span>
                    <span className="text-muted">{msg.referencedRecord.subtitle}</span>
                  </div>
                )}

                {/* Violet Underline AI Commitment Detected Chip */}
                {msg.detectedCommitment && (
                  <div className="ml-8 p-2.5 rounded bg-ai-tint/40 border border-ai/30 text-xs font-sans space-y-1 animate-fadeIn">
                    <div className="flex items-center justify-between text-ai font-semibold text-[12px] font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        AI Commitment Detected:
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-ai text-white text-[12px]">
                        Due {msg.detectedCommitment.dueDate}
                      </span>
                    </div>
                    <div className="text-slate-800 italic">
                      "{msg.detectedCommitment.promise}"
                    </div>
                    <div className="text-[12px] text-muted font-mono flex items-center gap-1 pt-0.5">
                      <CheckCircle2 className="w-3 h-3 text-strand-green" />
                      Auto-scheduled reminder for {msg.detectedCommitment.person}.
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Send Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-line bg-canvas/30 flex items-center gap-2">
            <input
              type="text"
              placeholder={`Message ${selectedChannel.name} (type commitments like 'I will dispatch by Friday')...`}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 p-2 text-xs bg-white border border-line rounded focus:outline-none focus:ring-1 focus:ring-kiran text-ink"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </div>

        {/* Right Pane (3 cols): Linked Record Context Card */}
        <div className="col-span-12 md:col-span-3 p-4 overflow-y-auto space-y-4 bg-canvas/20 font-mono text-xs">
          <div className="text-[12px] font-semibold text-muted border-b border-line pb-2 font-sans">
            Work-Anchored Context
          </div>

          {selectedChannel.referenceRecord ? (
            <div className="p-3 bg-white rounded border border-line space-y-2 shadow-2xs">
              <div>
                <div className="text-[12px] text-muted font-sans">
                  {selectedChannel.referenceRecord.type}
                </div>
                <div className="font-bold text-ink text-sm font-sans mt-0.5">
                  {selectedChannel.referenceRecord.title}
                </div>
                <div className="text-xs text-kiran font-semibold mt-0.5">
                  {selectedChannel.referenceRecord.id}
                </div>
              </div>

              <div className="pt-2 border-t border-line space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Status:</span>
                  <span className="font-semibold text-strand-amber">{selectedChannel.referenceRecord.status}</span>
                </div>
                {selectedChannel.referenceRecord.amount && (
                  <div className="flex justify-between text-slate-600">
                    <span>Value:</span>
                    <span className="font-bold text-ink">{formatINR(selectedChannel.referenceRecord.amount)}</span>
                  </div>
                )}
                {selectedChannel.referenceRecord.owner && (
                  <div className="flex justify-between text-slate-600 font-sans">
                    <span>Lead:</span>
                    <strong>{selectedChannel.referenceRecord.owner}</strong>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Link
                  to={`/rfq/${selectedChannel.referenceRecord.id}`}
                  className="w-full py-1.5 bg-canvas hover:bg-slate-200 border border-line rounded text-[12px] font-semibold text-slate-800 flex items-center justify-center gap-1 font-sans"
                >
                  <span>Open Primary Ticket</span>
                  <ExternalLink className="w-3 h-3 text-muted" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted text-xs font-sans">
              General operations alignment stream.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
