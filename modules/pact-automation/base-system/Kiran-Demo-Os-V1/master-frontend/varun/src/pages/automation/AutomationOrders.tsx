import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { usePipelineBoard } from '../../modules/pipeline/usePipeline';
import { OrderFlow } from '../../components/automation/OrderFlow';
import { TONE, sentenceCase, Tone } from '../../lib/tone';

/**
 * The orders board, and the flow for whichever one is selected.
 *
 * The list on the left is ordered by what moved most recently rather than by status,
 * because the question a presenter is answering is "what just happened", not "show me the
 * pending ones". The right-hand pane is the whole of an order's journey.
 *
 * A row's stamp is the *customer's* answer, not the job status. Those are different
 * facts and the customer's is the one that matters here: a job can be sitting at
 * PUSHED_TO_PACT and still have been approved five minutes ago, and it is the approval
 * that explains why anything happened at all.
 */
export const AutomationOrders: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { rows, error, loading } = usePipelineBoard();

  const selected = rows.find((row) => row.jobId === jobId) ?? rows[0] ?? null;

  // Keep the URL on something that exists, the way the on-hold queue does.
  useEffect(() => {
    if (!selected) return;
    if (jobId !== selected.jobId) {
      navigate(`/admin/automation/orders/${selected.jobId}`, { replace: true });
    }
  }, [selected, jobId, navigate]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      {/* ---- The board ------------------------------------------------- */}
      <section className="ku-sheet flex min-h-0 flex-col">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <p className="ku-eyebrow">Purchase orders</p>
            <h2 className="mt-1.5 font-display text-h3 font-semibold text-ink">
              In the automation
            </h2>
          </div>
          <dl>
            <dt className="ku-eyebrow">Orders</dt>
            <dd className="ku-fig mt-0.5 text-body font-semibold text-ink">{rows.length}</dd>
          </dl>
        </div>

        {error && (
          <p className="border-b border-hairline px-5 py-3 text-body-s text-st-red-ink">{error}</p>
        )}

        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-16 text-center">
            <Inbox aria-hidden className="h-6 w-6 text-hairline-strong" />
            <p className="text-body-s font-semibold text-ink">
              {loading ? 'Loading…' : 'No orders have reached the automation yet'}
            </p>
            <p className="max-w-sm text-body-s text-meta">
              Send a purchase order from one of the demo customers, or inject one from the
              Mailing Hub's control deck. It will appear here the moment it is read.
            </p>
          </div>
        ) : (
          <ul className="ku-ruled min-h-0 flex-1 overflow-y-auto">
            {rows.map((row) => {
              const active = row.jobId === selected?.jobId;
              const tone = STATUS_TONE[row.status] ?? 'grey';
              return (
                <li key={row.jobId}>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/automation/orders/${row.jobId}`)}
                    className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 border-l-3 px-5 py-3 text-left transition-colors duration-150 ${
                      active
                        ? `${TONE[tone as Tone].solid.replace('bg-', 'border-l-')} bg-canvas`
                        : 'border-l-transparent hover:bg-canvas'
                    }`}
                  >
                    <span className="ku-fig min-w-0 flex-1 basis-40 truncate text-body-s font-semibold text-ink">
                      {row.poNumber || '(no PO number)'}
                    </span>
                    <span className={`ku-stamp ${TONE[tone as Tone].stamp}`}>
                      {sentenceCase(row.statusLabel)}
                    </span>
                    {row.lineCount > 1 && (
                      <span className="ku-docket">{row.lineCount} lines</span>
                    )}
                    <span className="w-full min-w-0 truncate text-body-s text-meta">
                      {row.customer || '—'}
                    </span>
                    <span className="ku-docket">{row.jobId}</span>
                    {row.documentNo && (
                      <span className={`ku-stamp ${TONE.green.stamp}`}>
                        PACT {row.documentNo}
                      </span>
                    )}
                    <span className="ku-fig ml-auto shrink-0 text-caption text-meta">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleTimeString() : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- The selected order's flow --------------------------------- */}
      <section className="ku-sheet flex min-h-0 flex-col">
        {selected ? (
          <OrderFlow jobId={selected.jobId} />
        ) : (
          <div className="flex flex-1 items-center justify-center px-5 py-16">
            <p className="text-body-s text-meta">Select an order to see its journey.</p>
          </div>
        )}
      </section>
    </div>
  );
};

// Mirrors `mailing_workflow.STATUS_TONE`, so a status stamps the same colour everywhere.
const STATUS_TONE: Record<string, Tone> = {
  AWAITING_ADMIN_APPROVAL: 'amber',
  COMMITTED: 'green',
  ACKNOWLEDGED: 'green',
  AWAITING_ACCOUNTS_APPROVAL: 'amber',
  PUSHED_TO_PACT: 'green',
  COMPLETED: 'green',
  EXCEPTION: 'red',
  DISCARDED: 'grey',
};
