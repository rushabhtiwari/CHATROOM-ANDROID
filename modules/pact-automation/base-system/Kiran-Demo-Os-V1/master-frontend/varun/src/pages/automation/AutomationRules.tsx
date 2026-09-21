import React from 'react';
import { ArrowDown } from 'lucide-react';
import { usePipelineSummary } from '../../modules/pipeline/usePipeline';
import { TONE } from '../../lib/tone';

/**
 * The pipeline, drawn.
 *
 * A presenter is asked "what actually happens" more often than any other question, and
 * the honest answer has a shape: two things happen immediately and commit nothing, then
 * everything stops until the customer answers, then two things happen that do commit.
 *
 * This page is that shape, with the reason for each step written next to it. It is not a
 * settings screen — nothing here is editable, because every one of these rules is a
 * property of the code rather than a configuration value, and a page that implied
 * otherwise would be lying about where the guarantees live.
 */
export const AutomationRules: React.FC = () => {
  const { summary } = usePipelineSummary();

  return (
    <div className="space-y-6">
      <section className="ku-sheet">
        <div className="border-b border-hairline px-5 py-4">
          <p className="ku-eyebrow">The flow</p>
          <h2 className="mt-1.5 font-display text-h3 font-semibold text-ink">
            What happens to a purchase order
          </h2>
          <p className="mt-2 max-w-3xl text-body-s text-meta">
            Read top to bottom. The rule across the middle is the only place a decision is
            made by a person, and that person is the customer.
          </p>
        </div>

        <div className="px-5 py-6">
          <Phase label="Ungated" tone="grey" note="No agreement has been given or implied.">
            <Step
              index="1"
              title="The order is read"
              body="The message is deduplicated on its Message-ID and every attachment's SHA-256, classified, and extracted. Every value carries the line it came from; a value with no evidence behind it is worth zero confidence, not a guess."
            />
            <Step
              index="2"
              title="A receipt goes to the customer"
              body='Immediately, before anybody has looked at it. It says we have received the order and are reviewing it — and it may not say "accepted", "confirmed" or "approved". Those words describe a decision to supply, and sending them automatically would turn every inbound email into an apparent agreement.'
            />
            <Step
              index="3"
              title="Sales is notified"
              body="Also immediately, and it states plainly that nothing has been committed. Seeing an order early is how a wrong price gets caught before the customer is asked about it. If the customer is not in PACT's master, that is flagged here, while somebody can still fix it."
            />
          </Phase>

          {/* ---- Gate 1 ------------------------------------------------ */}
          <div className="my-6 border-y-2 border-ink py-4">
            <p className="ku-eyebrow">Gate 1 — the admin</p>
            <p className="mt-2 max-w-3xl text-body font-semibold text-ink">
              An admin approves the order. Only then does the customer hear that it was
              accepted, and only then does anybody inside the company get work to do.
            </p>
            <p className="mt-2 max-w-3xl text-body-s text-meta">
              The approval is attributed and recorded, and any correction the admin types is
              stamped as theirs at full confidence with the model's reading kept underneath.
              It sends the acknowledgement and opens tasks for Sales, Accounts and
              Manufacturing. Nothing here runs on a timer: an order nobody approves stays
              where it is.
            </p>
            {summary && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`ku-stamp ${TONE.amber.stamp}`}>
                  {summary.awaitingAdmin} awaiting an admin
                </span>
                <span className={`ku-stamp ${TONE.grey.stamp}`}>
                  {summary.tasksOpen} team tasks open
                </span>
              </div>
            )}
          </div>

          {/* ---- Into PACT --------------------------------------------- */}
          <div className="my-6 border-y-2 border-ink py-4">
            <p className="ku-eyebrow">Into PACT</p>
            <p className="mt-2 max-w-3xl text-body font-semibold text-ink">
              The approved order is released into PACT. This is the only edge into the
              accounting system, from anywhere.
            </p>
            <p className="mt-2 max-w-3xl text-body-s text-meta">
              One purchase order becomes one PACT document: every line of the order is typed
              into the same grid and committed with a single Save Draft. The release follows
              the admin approval by itself, so there is no second queue to work. Turning
              PACT_AUTO_RELEASE off puts a separate Accounts sign-off back in front of this
              step; nothing else about the path changes. There is no flag, threshold or
              timeout that reaches past the approval.
            </p>
            {summary && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`ku-stamp ${TONE.green.stamp}`}>
                  {summary.completed} completed
                </span>
              </div>
            )}
          </div>

          <Phase
            label="Gated"
            tone="green"
            note="Reachable only through the admin approval."
          >
            <Step
              index="4"
              title="A PACT Purchase Order draft is saved"
              body="KPAC types the order into the real PACT window and commits it with Save Draft. It never Posts — that action is not wired up anywhere. If the PACT window is closed the robot pauses rather than failing, and the order is retryable the moment somebody opens it."
            />
            <Step
              index="5"
              title="A demonstration proforma is sent"
              body="Generated from the PACT draft it cites, watermarked DEMO, and disclaimed in its first line. It is not a tax invoice and the renderer refuses to produce one. If PACT ran in dry run and produced no document, no proforma is generated at all — a bill for a document that does not exist is worse than no bill."
            />
            <Step
              index="6"
              title="The customer is told the order is on its way"
              body="The closing message carries the PACT document number, a dispatch date and a tracking reference. The last two are invented for the demonstration and the message says so in its own first line — and even with SMTP on, the pipeline refuses to transmit to any address that is not a reserved demo domain, the redirect inbox, or one explicitly allowed."
            />
          </Phase>
        </div>
      </section>

      <section className="ku-sheet">
        <div className="border-b border-hairline px-5 py-4">
          <p className="ku-eyebrow">Re-running</p>
          <h2 className="mt-1.5 font-display text-h3 font-semibold text-ink">
            Every step is safe to repeat
          </h2>
        </div>
        <div className="px-5 py-4">
          <p className="max-w-3xl text-body-s text-meta">
            Each of the five steps carries its own idempotency key, so re-running the pipeline
            after an interruption resumes rather than starting again: the receipt is not sent
            twice, a second PACT entry is not created, and the customer is not billed again. A
            step that failed stays retryable; a step that succeeded is skipped and says so.
            That is what makes a paused PACT window a recoverable inconvenience rather than a
            lost order.
          </p>
        </div>
      </section>
    </div>
  );
};

const Phase: React.FC<{
  label: string;
  tone: 'grey' | 'green';
  note: string;
  children: React.ReactNode;
}> = ({ label, tone, note, children }) => (
  <div>
    <div className="flex flex-wrap items-baseline gap-3">
      <span className={`ku-stamp ${TONE[tone].stamp}`}>{label}</span>
      <span className="text-body-s text-meta">{note}</span>
    </div>
    <ol className="mt-3 space-y-3">{children}</ol>
  </div>
);

const Step: React.FC<{ index: string; title: string; body: string }> = ({ index, title, body }) => (
  <li className="flex gap-4">
    <span className="ku-fig mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-hairline-strong text-caption font-semibold text-ink">
      {index}
    </span>
    <div className="min-w-0">
      <p className="text-body-s font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-3xl text-body-s text-meta">{body}</p>
    </div>
  </li>
);

export default AutomationRules;
