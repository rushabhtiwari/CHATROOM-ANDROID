import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Truck } from 'lucide-react';
import type { DispatchItem } from '@/types';
import { cn } from '@/lib/utils';
import { Empty, Screen } from '~/components/Screen';
import { DISPATCH_STAGES, listDispatches, stageIndex } from '~/lib/orders';
import { useAsync } from '~/lib/useAsync';
import { compactCurrency, compactQty, shortDate } from '~/lib/format';
import { tap } from '~/native/haptics';

export function DispatchesScreen() {
  const navigate = useNavigate();
  const { value: dispatches, loading } = useAsync(listDispatches, []);
  const [stage, setStage] = useState<DispatchItem['stage'] | 'all'>('all');

  const filtered = useMemo(
    () => (dispatches ?? []).filter((item) => stage === 'all' || item.stage === stage),
    [dispatches, stage],
  );

  const counts = useMemo(() => {
    const byStage = new Map<string, number>();
    for (const item of dispatches ?? []) {
      byStage.set(item.stage, (byStage.get(item.stage) ?? 0) + 1);
    }
    return byStage;
  }, [dispatches]);

  return (
    <Screen
      title="Dispatches"
      subtitle={dispatches ? `${dispatches.length} in flight` : undefined}
    >
      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-2">
        {(['all', ...DISPATCH_STAGES] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              tap();
              setStage(key);
            }}
            className={cn(
              'min-h-[32px] shrink-0 rounded-full border px-3 text-[13px] font-medium',
              stage === key
                ? 'border-brand bg-accent text-brand'
                : 'border-line bg-surface text-slate-600',
            )}
          >
            {key === 'all' ? 'All' : key}
            {key !== 'all' && counts.get(key) ? (
              <span className="ml-1 opacity-70">{counts.get(key)}</span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <Empty title="Loading dispatches…" />
      ) : filtered.length === 0 ? (
        <Empty title="Nothing at this stage" detail="Try another filter." />
      ) : (
        <div>
          {filtered.map((dispatch) => {
            const step = stageIndex(dispatch.stage);
            return (
              <button
                key={dispatch.id}
                type="button"
                onClick={() => navigate(`/dispatches/${dispatch.id}`)}
                className="w-full border-b border-line bg-surface px-4 py-3 text-left active:bg-slate-50"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">
                      {dispatch.customerName}
                    </p>
                    <p className="truncate text-[13px] text-slate-500">{dispatch.product}</p>
                  </div>
                  {dispatch.stopDispatchBlocked && (
                    <AlertTriangle
                      className="h-4 w-4 shrink-0 text-destructive"
                      aria-label="Dispatch blocked"
                    />
                  )}
                </div>

                <div className="mt-2 flex items-center gap-1.5" aria-hidden>
                  {DISPATCH_STAGES.map((name, index) => (
                    <span
                      key={name}
                      className={cn(
                        'h-1 flex-1 rounded-full',
                        index <= step ? 'bg-brand' : 'bg-slate-200',
                      )}
                    />
                  ))}
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[12px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    {dispatch.stage}
                  </span>
                  <span>
                    {compactQty(dispatch.quantity, dispatch.uom)} ·{' '}
                    {compactCurrency(dispatch.value)}
                  </span>
                </div>
                <p className="mt-0.5 font-code text-[11px] text-slate-400">
                  {dispatch.dispatchNumber} · {shortDate(dispatch.sldDate)}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
