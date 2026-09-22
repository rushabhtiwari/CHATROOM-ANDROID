import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { SalesOrder } from '@/types';
import { cn } from '@/lib/utils';
import { Empty, Screen } from '~/components/Screen';
import { executedPercent, listOrders } from '~/lib/orders';
import { useAsync } from '~/lib/useAsync';
import { compactCurrency, compactQty, shortDate } from '~/lib/format';

const STATUS_TONE: Record<SalesOrder['status'], string> = {
  Active: 'bg-accent text-brand',
  'Partially Executed': 'bg-strand-amber/15 text-strand-amber',
  Completed: 'bg-strand-green/15 text-strand-green',
  'Pending Production': 'bg-slate-100 text-slate-600',
};

function OrderCard({ order, onOpen }: { order: SalesOrder; onOpen: () => void }) {
  const percent = executedPercent(order);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full border-b border-line bg-surface px-4 py-3 text-left active:bg-slate-50"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{order.customerName}</p>
          <p className="truncate text-[13px] text-slate-500">{order.product}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-badge px-2 py-0.5 text-[11px] font-semibold',
            STATUS_TONE[order.status],
          )}
        >
          {order.status}
        </span>
      </div>

      <div className="mt-2.5">
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="font-code text-slate-500">{order.poNumber}</span>
          <span className="font-medium text-ink">{compactCurrency(order.poValue)}</span>
        </div>

        {/* Executed against ordered is the whole question this screen answers. */}
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Executed"
        >
          <div
            className={cn('h-full rounded-full', percent >= 100 ? 'bg-strand-green' : 'bg-brand')}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[12px] text-slate-500">
          <span>
            {compactQty(order.executedQty)} of {compactQty(order.poQty)} · {percent}%
          </span>
          <span>Next {shortDate(order.nextDeliveryDate)}</span>
        </div>
      </div>
    </button>
  );
}

export function OrdersScreen() {
  const navigate = useNavigate();
  const { value: orders, loading } = useAsync(listOrders, []);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orders ?? [];
    return (orders ?? []).filter((order) =>
      [order.customerName, order.product, order.poNumber, order.id, order.partNumber]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [orders, query]);

  return (
    <Screen title="Orders" subtitle={orders ? `${orders.length} sales orders` : undefined}>
      <div className="bg-surface px-4 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Customer, product or PO number"
            aria-label="Search orders"
            className="h-9 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {loading ? (
        <Empty title="Loading orders…" />
      ) : filtered.length === 0 ? (
        <Empty
          title="No orders match"
          detail="Search by customer, product, part number or PO."
        />
      ) : (
        <div className="border-t border-line">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onOpen={() => navigate(`/orders/${order.id}`)}
            />
          ))}
        </div>
      )}
    </Screen>
  );
}
