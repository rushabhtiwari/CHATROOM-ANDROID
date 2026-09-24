import React from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Empty, Screen, Section } from '~/components/Screen';
import { DISPATCH_STAGES, getDispatch, stageIndex } from '~/lib/orders';
import { useAsync } from '~/lib/useAsync';
import { compactCurrency, compactQty, shortDate } from '~/lib/format';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-touch items-center gap-3 px-4 py-2.5">
      <span className="w-[112px] shrink-0 text-[13px] text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 text-right text-[14px] text-ink">{value}</span>
    </div>
  );
}

export function DispatchDetailScreen() {
  const { dispatchId } = useParams<{ dispatchId: string }>();
  const { value: dispatch, loading } = useAsync(() => getDispatch(dispatchId ?? ''), [dispatchId]);

  if (loading) {
    return (
      <Screen back title="Dispatch">
        <Empty title="Loading…" />
      </Screen>
    );
  }

  if (!dispatch) {
    return (
      <Screen back title="Dispatch">
        <Empty title="Dispatch not found" detail={dispatchId} />
      </Screen>
    );
  }

  const step = stageIndex(dispatch.stage);

  return (
    <Screen back title={dispatch.customerName} subtitle={dispatch.dispatchNumber}>
      {dispatch.stopDispatchBlocked && (
        <div className="flex items-start gap-2 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-[14px] font-semibold text-destructive">Dispatch blocked</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
              {compactCurrency(dispatch.overdueAmountCustomer)} overdue on this account. Accounts
              must release the hold before this consignment can move.
            </p>
          </div>
        </div>
      )}

      <div className="border-b border-line bg-surface px-4 py-3">
        <p className="text-[14px] text-ink">{dispatch.product}</p>
        <p className="mt-0.5 font-code text-[12px] text-slate-500">{dispatch.partNumber}</p>
      </div>

      {/* The pipeline, vertically: on a phone this reads as a shipment's
          history far better than the console's horizontal board does. */}
      <Section title="Progress">
        <ol className="px-4 py-3">
          {DISPATCH_STAGES.map((stage, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={stage} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold',
                      done && 'border-strand-green bg-strand-green text-white',
                      current && 'border-brand bg-brand text-white',
                      !done && !current && 'border-slate-300 bg-surface text-slate-400',
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  {index < DISPATCH_STAGES.length - 1 && (
                    <span
                      className={cn(
                        'w-0.5 flex-1',
                        index < step ? 'bg-strand-green' : 'bg-slate-200',
                      )}
                      style={{ minHeight: 22 }}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    'pb-4 text-[14px]',
                    current ? 'font-semibold text-ink' : done ? 'text-ink-3' : 'text-slate-400',
                  )}
                >
                  {stage}
                </span>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="Consignment">
        <Field label="Quantity" value={compactQty(dispatch.quantity, dispatch.uom)} />
        <Field label="Value" value={compactCurrency(dispatch.value)} />
        <Field
          label="Invoice"
          value={<span className="font-code">{dispatch.invoiceNumber}</span>}
        />
        {dispatch.asnNumber && (
          <Field label="ASN" value={<span className="font-code">{dispatch.asnNumber}</span>} />
        )}
        <Field label="SLD date" value={shortDate(dispatch.sldDate)} />
        {dispatch.invoiceDate && (
          <Field label="Invoice date" value={shortDate(dispatch.invoiceDate)} />
        )}
      </Section>

      <Section title="In transit">
        <Field label="Carrier" value={dispatch.carrier} />
        <Field
          label="Vehicle"
          value={<span className="font-code">{dispatch.vehicleNumber}</span>}
        />
        <Field label="Destination" value={dispatch.destination} />
      </Section>

      <Section title="Acknowledgement">
        <Field label="Status" value={dispatch.acknowledgementStatus} />
        <Field label="POD" value={dispatch.podStatus} />
        <Field
          label="Reminders"
          value={dispatch.remindersSent === 0 ? 'None sent' : `${dispatch.remindersSent} sent`}
        />
        {dispatch.nextReminderDate && (
          <Field label="Next reminder" value={shortDate(dispatch.nextReminderDate)} />
        )}
      </Section>
    </Screen>
  );
}
