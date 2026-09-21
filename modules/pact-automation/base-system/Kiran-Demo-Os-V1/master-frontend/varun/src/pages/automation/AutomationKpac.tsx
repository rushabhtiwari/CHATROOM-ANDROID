import React from 'react';
import { Bot, CheckCircle2, Cpu, ShieldAlert, XCircle } from 'lucide-react';
import { usePipelineSummary } from '../../modules/pipeline/usePipeline';
import { TONE } from '../../lib/tone';

/**
 * KPAC — the robot that types into the real PACT RevenU window.
 *
 * This page exists because KPAC is not a normal service and the three things that make it
 * unusual are the three things a presenter needs to see before starting:
 *
 *   1. it drives a human's desktop, so there is one window and one keyboard focus;
 *   2. it can *pause* rather than fail, which is a recoverable state and not an error;
 *   3. it has a **profile** — which PACT document it is pointed at — and pointing it at
 *      the wrong one is the failure that would be visible to a client.
 *
 * The page is deliberately read-only. Everything here is configured in KPAC's own `.env`
 * or in this backend's, and a console that let an operator flip DRY RUN off with a click
 * would be a console that could save a real PACT document by accident.
 */
export const AutomationKpac: React.FC = () => {
  const { summary } = usePipelineSummary();
  const kpac = summary?.kpac;

  return (
    <div className="space-y-6">
      {/* ---- The robot --------------------------------------------------- */}
      <section className="ku-sheet">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <p className="ku-eyebrow">The bridge</p>
            <h2 className="mt-1.5 font-display text-h3 font-semibold text-ink">
              KPAC — PACT Automation
            </h2>
          </div>
          <span
            className={`ku-stamp ${
              kpac?.reachable ? TONE.green.stamp : TONE.red.stamp
            }`}
          >
            {kpac?.reachable ? 'reachable' : 'offline'}
          </span>
        </div>

        <div className="px-5 py-4">
          <p className="flex items-start gap-2 text-body-s text-meta">
            {kpac?.reachable ? (
              <CheckCircle2 aria-hidden size={15} className="mt-0.5 shrink-0 text-st-green-ink" />
            ) : (
              <XCircle aria-hidden size={15} className="mt-0.5 shrink-0 text-st-red-ink" />
            )}
            <span>{kpac?.detail ?? 'Checking…'}</span>
          </p>

          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            <Row label="Worker" value={kpac?.workerAlive ? 'running' : 'not running'} />
            <Row label="State" value={kpac?.busy ? 'busy' : 'idle'} />
            <Row label="Mode" value={kpac?.mode ?? '—'} mono />
            <Row label="Loaded profile" value={kpac?.profile ?? '—'} mono />
            <Row label="Console expects" value={summary?.kpacProfile ?? '—'} mono />
            <Row label="Commits with" value="Save Draft (Ctrl+Shift+D)" />
          </dl>

          {kpac?.reachable && kpac.profileMatches === false && (
            <p className="mt-4 flex items-start gap-2 border border-st-red-line bg-st-red-bg px-3 py-2 text-body-s text-ink">
              <ShieldAlert aria-hidden size={15} className="mt-0.5 shrink-0" />
              <span>
                <strong>Profile mismatch.</strong> Nothing will be pushed while these differ.
                Set <code className="ku-fig">PROFILE</code> in KPAC's own <code className="ku-fig">.env</code>
                {' '}and reload its settings, or change <code className="ku-fig">KPAC_PROFILE</code> here.
              </span>
            </p>
          )}

          {kpac?.reachable && kpac.dryRun && (
            <p className="mt-4 flex items-start gap-2 border border-st-amber-line bg-st-amber-bg px-3 py-2 text-body-s text-ink">
              <Cpu aria-hidden size={15} className="mt-0.5 shrink-0" />
              <span>
                <strong>DRY RUN is on.</strong> KPAC will fill the PACT form and run its
                verifier, then discard the draft. That is the right setting for a rehearsal —
                and because no document number comes back, no proforma is generated either.
                Turn it off in KPAC's <code className="ku-fig">.env</code> for a real draft.
              </span>
            </p>
          )}
        </div>
      </section>

      {/* ---- The one rule that cannot be configured away ------------------- */}
      <section className="ku-sheet">
        <div className="border-b border-hairline px-5 py-4">
          <p className="ku-eyebrow">Safety</p>
          <h2 className="mt-1.5 font-display text-h3 font-semibold text-ink">
            What this system will not do
          </h2>
        </div>
        <ul className="ku-ruled">
          <Rule title="It never Posts a PACT document.">
            KPAC commits with <strong>Save Draft</strong> only. The <code className="ku-fig">post</code>
            {' '}action is not wired up in the robot, is not called from this backend, and there is
            no setting that would reach it. A draft has not entered the books.
          </Rule>
          <Rule title="It never guesses a customer.">
            A name that is not in PACT's master fails that order with{' '}
            <code className="ku-fig">customer not in PACT master: &lt;name&gt;</code> and stops.
            No trigram similarity, no nearest match, no "it is obviously that one" — those are
            all ways of filing an order against the wrong company's account.
          </Rule>
          <Rule title="It never treats silence as agreement.">
            An invitation that expires returns the order to a person. There is no timeout, no
            confidence threshold and no flag that reaches the PACT step without the customer's
            explicit answer.
          </Rule>
          <Rule title="It never produces a tax invoice.">
            The proforma is watermarked DEMO and says so in its first line. The renderer
            refuses to return a document that describes itself as a tax invoice or carries a
            GSTIN, a tax breakdown or bank details.
          </Rule>
        </ul>
      </section>

      {/* ---- Demo customers ------------------------------------------------ */}
      <section className="ku-sheet">
        <div className="border-b border-hairline px-5 py-4">
          <p className="ku-eyebrow">Reference data</p>
          <h2 className="mt-1.5 font-display text-h3 font-semibold text-ink">
            Demo customers
          </h2>
          <p className="mt-2 max-w-2xl text-body-s text-meta">
            Four synthetic companies that exist in this console and in PACT's master under
            identical names, so the mapping between the two systems is the identity mapping
            and the seam is visible without doing any work. The names must match
            character-for-character in both.
          </p>
        </div>
        <ul className="ku-ruled">
          {(summary?.demoCustomers ?? []).map((customer) => (
            <li
              key={customer.name}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3"
            >
              <Bot aria-hidden size={14} className="shrink-0 text-hairline-strong" />
              <span className="min-w-0 flex-1 basis-64 truncate text-body-s font-semibold text-ink">
                {customer.name}
              </span>
              <span className="ku-fig text-body-s text-meta">{customer.email}</span>
              <span className="ku-stamp border-st-grey-ink text-st-grey-ink">{customer.city}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Where mail goes ------------------------------------------------ */}
      <section className="ku-sheet">
        <div className="border-b border-hairline px-5 py-4">
          <p className="ku-eyebrow">Delivery</p>
          <h2 className="mt-1.5 font-display text-h3 font-semibold text-ink">
            Where the messages go
          </h2>
        </div>
        <div className="px-5 py-4">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            <Row
              label="Customer mail"
              value={summary?.mailRedirect ?? 'to the customer address on the order'}
              mono
            />
            <Row
              label="Internal notice"
              value={(summary?.internalRecipients ?? []).join(', ') || '—'}
              mono
            />
          </dl>
          <p className="mt-3 max-w-2xl text-body-s text-meta">
            The demo customers live on reserved <code className="ku-fig">.example</code> domains,
            which can never receive mail — so it is not possible to write to a real company by
            accident. Set <code className="ku-fig">DEMO_MAIL_REDIRECT</code> to an inbox you own
            and every customer-facing message is delivered there instead, with the intended
            recipient kept on the ledger. Sending itself is opt-in:{' '}
            <code className="ku-fig">SMTP_SEND=true</code>.
          </p>
        </div>
      </section>
    </div>
  );
};

const Row: React.FC<{ label: string; value?: string | null; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="flex min-w-0 items-baseline gap-3">
    <dt className="ku-docket w-32 shrink-0">{label}</dt>
    <dd className={`min-w-0 flex-1 break-words text-body-s text-ink ${mono ? 'ku-fig' : ''}`}>
      {value || '—'}
    </dd>
  </div>
);

const Rule: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <li className="px-5 py-3.5">
    <p className="text-body-s font-semibold text-ink">{title}</p>
    <p className="mt-1 max-w-3xl text-body-s text-meta">{children}</p>
  </li>
);
