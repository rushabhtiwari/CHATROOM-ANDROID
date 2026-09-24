import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { SalesOrder } from '@/types';
import { cn } from '@/lib/utils';
import { Empty, Screen, Section } from '~/components/Screen';
import { executedPercent, getOrder } from '~/lib/orders';
import { useAsync } from '~/lib/useAsync';
import { compactCurrency, compactQty, shortDate } from '~/lib/format';
import { tap } from '~/native/haptics';

type Tab = 'schedule' | 'work' | 'dispatches';

const BUCKET_TONE: Record<SalesOrder['weeklyBuckets'][number]['status'], string> = {
  Delivered: 'bg-strand-green',
  Dispatched: 'bg-brand',
  'In Production': 'bg-strand-amber',
  Scheduled: 'bg-slate-300',
};

const WORK_TONE: Record<SalesOrder['workOrders'][number]['status'], string> = {
  Completed: 'text-strand-green',
  Running: 'text-brand',
  Queued: 'text-slate-500',
};

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-ink">{value}</p>
    </div>
  );
}

export function OrderDetailScreen() {
  const { orderId } = useParams<{ orderId: string }>();
  const { value: order, loading } = useAsync(() => getOrder(orderId ?? ''), [orderId]);
  const [tab, setTab] = useState<Tab>('schedule');

  if (loading)
    return (
      <Screen back title="Order">
        <Empty title="Loading…" />
      </Screen>
    );
  if (!order) {
    return (
      <Screen back title="Order">
        <Empty title="Order not found" detail={orderId} />
      </Screen>
    );
  }

  const percent = executedPercent(order);

  return (
    <Screen back title={order.customerName} subtitle={order.poNumber}>
      <div className="border-b border-line bg-surface px-4 py-3">
        <p className="text-[14px] text-ink">{order.product}</p>
        <p className="mt-0.5 font-code text-[12px] text-slate-500">{order.partNumber}</p>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
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
        <p className="mt-1.5 text-[12px] text-slate-500">
          {compactQty(order.executedQty)} executed of {compactQty(order.poQty)} · {percent}%
        </p>

        <div className="mt-3 flex gap-3 border-t border-line pt-3">
          <Figure label="Order value" value={compactCurrency(order.poValue)} />
          <Figure label="Balance" value={compactCurrency(order.balanceValue)} />
          <Figure label="Next delivery" value={shortDate(order.nextDeliveryDate)} />
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Order detail"
        className="flex gap-1 border-b border-line bg-surface px-3 py-2"
      >
        {(
          [
            ['schedule', `Schedule (${order.weeklyBuckets.length})`],
            ['work', `Work orders (${order.workOrders.length})`],
            ['dispatches', `Dispatches (${order.dispatches.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              tap();
              setTab(key);
            }}
            className={cn(
              'min-h-[34px] flex-1 rounded-lg px-2 text-[12px] font-medium',
              tab === key ? 'bg-accent text-brand' : 'text-slate-500 active:bg-slate-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <Section>
          {order.weeklyBuckets.map((bucket) => (
            <div key={bucket.week} className="flex min-h-touch items-center gap-3 px-4 py-2.5">
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', BUCKET_TONE[bucket.status])}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{bucket.week}</span>
              <span className="shrink-0 text-[13px] text-slate-600">{compactQty(bucket.qty)}</span>
              <span className="w-[86px] shrink-0 text-right text-[12px] text-slate-500">
                {bucket.status}
              </span>
            </div>
          ))}
        </Section>
      )}

      {tab === 'work' && (
        <Section>
          {order.workOrders.length === 0 ? (
            <Empty title="No work orders" />
          ) : (
            order.workOrders.map((work) => (
              <div key={work.id} className="px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-code text-[13px] text-ink">{work.id}</span>
                  <span className={cn('ml-auto text-[12px] font-semibold', WORK_TONE[work.status])}>
                    {work.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {work.machine} · {work.cutLength} · {compactQty(work.quantity)}
                </p>
              </div>
            ))
          )}
        </Section>
      )}

      {tab === 'dispatches' && (
        <Section>
          {order.dispatches.length === 0 ? (
            <Empty title="Nothing dispatched yet" />
          ) : (
            order.dispatches.map((dispatch) => (
              <div
                key={dispatch.invoiceNo}
                className="flex min-h-touch items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-code text-[13px] text-ink">{dispatch.invoiceNo}</p>
                  <p className="text-[12px] text-slate-500">{shortDate(dispatch.date)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-medium text-ink">
                    {compactCurrency(dispatch.amount)}
                  </p>
                  <p className="text-[12px] text-slate-500">{compactQty(dispatch.qty)}</p>
                </div>
              </div>
            ))
          )}
        </Section>
      )}
    </Screen>
  );
}
