import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, FileCheck2, Users, ShoppingCart, ReceiptText } from 'lucide-react';
import { mockRFQs } from '../../data/rfqs';
import { mockQuotations } from '../../data/quotations';
import { mockCustomers } from '../../data/customers';
import { mockSalesOrders } from '../../data/orders';
import { mockPeople } from '../../data/people';
import { useRts } from '@/modules/rts/store';
import { formatCurrency } from '@/modules/rts/format';
import { statusLabel } from '@/modules/rts/status';
import { useWorkspace } from '@/lib/workspace';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { requests, employeeById } = useRts();
  const { navGroups } = useWorkspace();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build Results
  const q = query.toLowerCase().trim();

  // The palette offers what the rail offers: a department can jump to its own
  // tools and to the shared ones, and records only surface where their screen
  // is part of this workspace.
  const staticActions = navGroups.flatMap((group) =>
    group.items
      .filter((item) => item.path !== undefined)
      .map((item) => ({
        id: `go-${item.path}`,
        title: item.name,
        category: group.label,
        icon: item.icon,
        path: item.path as string,
        mono: 'GO',
      })),
  );
  const railPaths = staticActions.map((action) => action.path);
  const reachable = <T extends { path: string }>(results: T[]): T[] =>
    results.filter((result) =>
      railPaths.some((path) => result.path === path || result.path.startsWith(`${path}/`)),
    );

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
      category: 'Claims',
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
      subtitle: `${r.stage} · ${r.quantity.toLocaleString('en-IN')} m`,
      category: 'RFQs',
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
      subtitle: `${c.city}, ${c.state}`,
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
      subtitle: `${qu.status} · ${qu.rfqNumber}`,
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
      subtitle: `${o.balanceQty.toLocaleString('en-IN')} m pending · ₹${o.balanceValue.toLocaleString('en-IN')}`,
      category: 'Sales orders',
      icon: ShoppingCart,
      path: `/orders/${o.id}`,
      mono: o.poNumber
    }));

  const allResults = q
    ? [
        ...staticActions.filter((a) => a.title.toLowerCase().includes(q)),
        ...reachable([
          ...claimResults,
          ...rfqResults,
          ...quoteResults,
          ...orderResults,
          ...customerResults,
        ]),
      ]
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
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-[12vh] px-4 animate-overlay-in">
      <div
        className="w-full max-w-xl bg-surface rounded-xl shadow-modal border border-line overflow-hidden flex flex-col max-h-[72vh] animate-dialog-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="px-4 h-14 border-b border-line flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search"
            aria-label="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full text-[16px] bg-transparent focus:outline-none focus-visible:shadow-none text-ink placeholder:text-slate-500"
          />
          <kbd className="text-[12px] px-1.5 py-0.5 rounded border border-line text-muted">Esc</kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {allResults.length === 0 ? (
            <div className="p-10 text-center text-muted text-[14px]">No results.</div>
          ) : (
            allResults.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              const subtitle = 'subtitle' in item ? (item as { subtitle?: string }).subtitle : undefined;

              return (
                <div
                  key={`${item.category}-${item.id}`}
                  onClick={() => handleSelect(item.path)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-md text-[14px] flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-kiran-tint' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-ink truncate">{item.title}</span>
                        {item.mono !== 'GO' && (
                          <span className="font-code text-[13px] text-muted whitespace-nowrap">{item.mono}</span>
                        )}
                      </div>
                      {subtitle && <div className="text-[13px] text-muted truncate">{subtitle}</div>}
                    </div>
                  </div>

                  <span className="text-[13px] text-muted whitespace-nowrap shrink-0">{item.category}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
