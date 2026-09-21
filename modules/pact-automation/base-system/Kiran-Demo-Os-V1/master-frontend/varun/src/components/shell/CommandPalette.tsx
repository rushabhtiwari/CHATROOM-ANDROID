import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  FileCheck2,
  Users,
  ShoppingCart,
  Truck,
  Sparkles,
  Command,
  ArrowRight,
  PlusCircle,
  Calculator,
  Bot,
  MessageSquareText,
  CalendarDays,
  ReceiptText,
  ClipboardCheck,
  Banknote
} from 'lucide-react';
import { mockRFQs } from '../../data/rfqs';
import { mockQuotations } from '../../data/quotations';
import { mockCustomers } from '../../data/customers';
import { mockSalesOrders } from '../../data/orders';
import { mockPeople } from '../../data/people';
import { useRts } from '@/modules/rts/store';
import { formatCurrency } from '@/modules/rts/format';
import { statusLabel } from '@/modules/rts/status';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const { requests, employeeById } = useRts();

  useEffect(() => {
    if (isOpen) {
      restoreFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    } else {
      restoreFocusRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }

      if (e.key === 'Tab' && isOpen && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build Results
  const q = query.toLowerCase().trim();

  const staticActions = [
    { id: 'act-1', title: 'Mailbox - Emails', category: 'Mail monitoring', icon: FileText, path: '/admin/mailing/inbox', mono: 'MAIL:INBOX' },
    { id: 'act-2', title: 'Mailbox - On Hold', category: 'Mail monitoring', icon: FileText, path: '/admin/mailing/on-hold', mono: 'MAIL:ON_HOLD' },
    { id: 'act-3', title: 'Mailbox - Analytics', category: 'Mail monitoring', icon: FileText, path: '/admin/mailing/analytics', mono: 'MAIL:ANALYTICS' },
    { id: 'act-4', title: 'Orders - approve and run into PACT', category: 'PACT entry', icon: Bot, path: '/admin/automation/orders', mono: 'PACT:ORDERS' },
    { id: 'act-5', title: 'KPAC & PACT bridge', category: 'PACT entry', icon: Bot, path: '/admin/automation/kpac', mono: 'PACT:KPAC' },
    { id: 'act-6', title: 'Automation rules', category: 'PACT entry', icon: Bot, path: '/admin/automation/rules', mono: 'PACT:RULES' },
    { id: 'act-7', title: 'PACT Automation Operations', category: 'PACT entry', icon: Bot, path: '/pact', mono: 'ACTION:PACT' },
  ];

  // Claims are live records rather than fixtures, so they are searched against
  // the same store the reimbursement screens read.
  const claimResults = requests
    .filter(
      (request) =>
        request.id.toLowerCase().includes(q) ||
        request.title.toLowerCase().includes(q) ||
        (employeeById(request.employeeId)?.name ?? '').toLowerCase().includes(q),
    )
    .slice(0, 4)
    .map((request) => ({
      id: request.id,
      title: `${request.title} — ${formatCurrency(request.amount)}`,
      subtitle: `${employeeById(request.employeeId)?.name ?? 'Unknown'} · ${statusLabel(request.status)}`,
      category: 'Reimbursement claims',
      icon: ReceiptText,
      path: `/reimbursements/${request.id}`,
      mono: request.id,
    }));

  const rfqResults = mockRFQs
    .filter((r) => r.rfqNumber.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q) || r.partNumber.toLowerCase().includes(q))
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      title: `${r.customerName} — ${r.partNumber}`,
      subtitle: `${r.stage} · Qty: ${r.quantity.toLocaleString('en-IN')}m`,
      category: 'RFQs & Tickets',
      icon: FileText,
      path: `/rfq/${r.id}`,
      mono: r.rfqNumber
    }));

  const customerResults = mockCustomers
    .filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: `${c.region} Zone · ${c.city}, ${c.state}`,
      category: 'Customers',
      icon: Users,
      path: `/rfq`,
      mono: c.code
    }));

  const quoteResults = mockQuotations
    .filter((qu) => qu.quoteNumber.toLowerCase().includes(q) || qu.customerName.toLowerCase().includes(q))
    .slice(0, 3)
    .map((qu) => ({
      id: qu.id,
      title: `${qu.customerName} — ₹${qu.totalValue.toLocaleString('en-IN')}`,
      subtitle: `Status: ${qu.status} · Linked: ${qu.rfqNumber}`,
      category: 'Quotations',
      icon: FileCheck2,
      path: `/quotations/${qu.id}`,
      mono: qu.quoteNumber
    }));

  const orderResults = mockSalesOrders
    .filter((o) => o.poNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q))
    .slice(0, 3)
    .map((o) => ({
      id: o.id,
      title: `${o.customerName} — ${o.product}`,
      subtitle: `Balance: ${o.balanceQty.toLocaleString('en-IN')}m (₹${o.balanceValue.toLocaleString('en-IN')})`,
      category: 'Sales Orders',
      icon: ShoppingCart,
      path: `/orders/${o.id}`,
      mono: o.poNumber
    }));

  const allResults = q
    ? staticActions.filter((a) => a.title.toLowerCase().includes(q))
    : staticActions;

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allResults.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allResults.length) % (allResults.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex].path);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[3px] flex items-start justify-center pt-[12vh] px-4 animate-overlay-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="w-full max-w-2xl bg-surface border border-line overflow-hidden flex flex-col max-h-[72vh] animate-dialog-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Box */}
        <div className="px-4 py-4 border-b border-line flex items-center gap-3 bg-surface-2">
          <h2 id="command-palette-title" className="sr-only">Command palette</h2>
          <Search className="w-5 h-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Search commands and records"
            aria-controls="command-palette-results"
            aria-activedescendant={allResults[selectedIndex] ? `command-result-${allResults[selectedIndex].id}` : undefined}
            placeholder="Type a command or search records (e.g. 'Motherson', 'RFQ-0418', 'reconciliation')..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full text-[15px] bg-transparent focus-visible:ring-2 focus-visible:ring-primary/40 text-ink placeholder:text-muted/80"
          />
          <kbd className="font-mono text-[12px] px-1.5 py-0.5 bg-white border border-line text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div id="command-palette-results" role="listbox" aria-label="Command results" className="flex-1 overflow-y-auto p-2 space-y-1">
          {allResults.length === 0 ? (
            <div className="p-8 text-center text-muted text-xs">
              No matching records or actions found for "{query}".
            </div>
          ) : (
            allResults.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={`${item.category}-${item.id}`}
                  id={`command-result-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item.path)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-2.5 text-xs flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-kiran-tint text-kiran' : 'hover:bg-canvas text-slate'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-kiran text-white' : 'bg-canvas text-slate-600 border border-line'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink truncate">{item.title}</span>
                        <span className="font-mono text-[12px] text-muted px-1 bg-slate-100 border border-line">
                          {item.mono}
                        </span>
                      </div>
                      {'subtitle' in item && (item as any).subtitle && (
                        <div className="text-[12px] text-muted truncate">{(item as any).subtitle}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] font-mono text-muted ">
                      {item.category}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-canvas border-t border-line flex items-center justify-between text-[12px] text-muted">
          <span>
            Use <kbd className="font-mono bg-white px-1 border border-line ">↑</kbd>{' '}
            <kbd className="font-mono bg-white px-1 border border-line ">↓</kbd> to navigate,{' '}
            <kbd className="font-mono bg-white px-1 border border-line ">↵</kbd> to select
          </span>
          <span className="font-mono text-[12px]">KiranOS Intelligence Engine</span>
        </div>
      </div>
    </div>
  );
};
