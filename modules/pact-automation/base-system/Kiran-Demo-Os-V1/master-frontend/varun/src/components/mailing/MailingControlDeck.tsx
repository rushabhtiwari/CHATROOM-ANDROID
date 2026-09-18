import React, { useRef, useState } from 'react';
import { AlertTriangle, Link2, Paperclip, Pause, Play, Plug, RefreshCw, Send, Unplug, X } from 'lucide-react';
import { mailingApi } from '../../modules/mailing/api';
import type { Mailbox, MailingSummary } from '../../modules/mailing/types';
import { useAsync, useMailingVersion } from '../../modules/mailing/useMailing';

interface Props {
  summary: MailingSummary | null;
  connected: boolean;
  onChanged: () => void;
}

const ACTOR = 'r.deshmukh';

/**
 * The Top Control Deck (WORKING.md §3.1).
 *
 * Two jobs, side by side and always visible: say whether the watcher is alive,
 * and let an operator put a message into the pipeline by hand. The injector is
 * not a mock — it posts to `/direct-send`, which runs the identical code path an
 * IMAP message takes, so a test PO that behaves differently from a real one
 * cannot happen.
 */
export const MailingControlDeck: React.FC<Props> = ({ summary, connected, onChanged }) => {
  const monitor = summary?.monitor;

  const version = useMailingVersion();
  const { data: connection, reload: reloadConnection } = useAsync(
    () => mailingApi.monitor(),
    [version],
  );
  const mailbox: Mailbox | null = connection?.mailbox ?? null;

  const [open, setOpen] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [busy, setBusy] = useState(false);

  // The mailbox form. The password lives in component state for exactly as long
  // as it takes to POST it, and is cleared the moment the server has it.
  const [mailAddress, setMailAddress] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [folder, setFolder] = useState('INBOX');
  const [notice, setNotice] = useState<{ tone: 'green' | 'amber' | 'red'; text: string } | null>(null);

  const [fromAddress, setFromAddress] = useState('procurement@mothersonsumi.com');
  const [toAddress, setToAddress] = useState('orders@kirancable.com');
  const [subject, setSubject] = useState('Purchase Order PO-MOTH-2026-995');
  const [bodyText, setBodyText] = useState(
    'Dear Kiran Cable Protection,\n\n' +
      'Please supply 12,000 m of Silicone Coated Fiberglass Sleeve 6mm Black against ' +
      'the attached purchase order.\n\n' +
      'Value Rs 1,80,000\n' +
      'Delivery: 2026-10-15\n\n' +
      'Regards,\nProcurement Desk',
  );
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (cause) {
      setNotice({ tone: 'red', text: cause instanceof Error ? cause.message : 'Request failed.' });
    } finally {
      setBusy(false);
    }
  };

  const poll = () =>
    run(async () => {
      const result = await mailingApi.poll(ACTOR);
      setNotice({
        tone: 'green',
        text:
          result.newMessages > 0
            ? `Poll complete — ${result.newMessages} new message(s).`
            : 'Poll complete. No new messages on the server.',
      });
      onChanged();
    });

  const togglePause = () =>
    run(async () => {
      const next = !monitor?.paused;
      await mailingApi.setPaused(next, ACTOR);
      setNotice({ tone: 'amber', text: next ? 'Watcher paused.' : 'Watcher resumed.' });
      onChanged();
    });

  const send = () =>
    run(async () => {
      const result = await mailingApi.directSend({
        fromAddress,
        toAddress,
        subject,
        bodyText,
        actor: ACTOR,
        attachments: files,
      });

      if (result.deduplicated) {
        // Not an error: this is §1.3 doing its job, and the operator should see
        // exactly which record it collided with.
        setNotice({
          tone: 'amber',
          text: `Already ingested as ${result.emailLogId}. ${result.reason ?? ''}`,
        });
      } else {
        setNotice({
          tone: 'green',
          text: `Injected as ${result.emailLogId} — pipeline settled at ${result.status}.`,
        });
        setFiles([]);
        if (fileInput.current) fileInput.current.value = '';
      }
      onChanged();
    });

  const connect = () =>
    run(async () => {
      const result = await mailingApi.connect({
        address: mailAddress.trim(),
        password: appPassword,
        host: imapHost.trim(),
        mailbox: folder.trim() || 'INBOX',
        actor: ACTOR,
      });
      setAppPassword(''); // never keep it around once the server has it
      setShowConnect(false);
      setNotice({
        tone: 'green',
        text:
          `Connected ${result.mailbox.address} — ` +
          `${result.messageCount.toLocaleString()} message(s) in the mailbox. ` +
          `Watching from the newest, so nothing already there is ingested.`,
      });
      reloadConnection();
      onChanged();
    });

  const disconnect = () =>
    run(async () => {
      await mailingApi.disconnect(ACTOR);
      setNotice({ tone: 'amber', text: 'Mailbox disconnected. The ledger is untouched.' });
      reloadConnection();
      onChanged();
    });

  const live = connected && !monitor?.paused && !monitor?.lastError;

  return (
    <section className="ku-card" aria-label="Mailbox and direct mailing">
      {/* ---- Connection monitor -------------------------------------- */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-hairline px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${
              live ? 'bg-st-green-ink' : monitor?.paused ? 'bg-st-amber-ink' : 'bg-st-red-ink'
            }`}
          />
          <span className="ku-eyebrow">
            {monitor?.connection ?? 'IMAP'} watcher
          </span>
          <span className="ku-stamp border-st-grey-ink text-st-grey-ink">
            {monitor?.paused ? 'Paused' : connected ? 'Running' : 'Reconnecting'}
          </span>
        </div>

        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-caption text-meta">
          <div>
            <dt className="ku-eyebrow">Mailbox</dt>
            <dd className="mt-0.5 text-body-s text-ink">
              {mailbox ? `${mailbox.address} · ${mailbox.mailbox}` : 'Not connected'}
            </dd>
          </div>
          <div>
            <dt className="ku-eyebrow">Last checked</dt>
            <dd className="ku-fig mt-0.5 text-body-s text-ink">
              {monitor?.lastCheckedAt ? new Date(monitor.lastCheckedAt).toLocaleTimeString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="ku-eyebrow">Polls</dt>
            <dd className="ku-fig mt-0.5 text-body-s text-ink">
              {monitor?.pollCount?.toLocaleString() ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="ku-eyebrow">Source</dt>
            <dd className="mt-0.5 text-body-s text-ink">
              {mailbox ? (mailbox.source === 'connected' ? 'Console' : 'Env file') : '—'}
            </dd>
          </div>
          <div>
            <dt className="ku-eyebrow">Last error</dt>
            <dd
              className={`mt-0.5 text-body-s ${monitor?.lastError ? 'text-st-red-ink' : 'text-ink'}`}
            >
              {monitor?.lastError ?? 'None'}
            </dd>
          </div>
        </dl>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={poll}
            disabled={busy || monitor?.paused}
            title="Run the watcher poll now"
            className="inline-flex h-9 items-center gap-2 border-2 border-hairline-strong bg-white px-3 text-body-s font-semibold leading-none text-ink transition-all duration-150 hover:border-ink hover:bg-canvas active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0"
          >
            <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            Run poll now
          </button>
          <button
            type="button"
            onClick={togglePause}
            disabled={busy}
            title={monitor?.paused ? 'Resume the watcher' : 'Pause the watcher'}
            className="inline-flex h-9 items-center gap-2 border-2 border-hairline-strong bg-white px-3 text-body-s font-semibold leading-none text-ink transition-all duration-150 hover:border-ink hover:bg-canvas active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {monitor?.paused ? <Play aria-hidden className="h-3.5 w-3.5" /> : <Pause aria-hidden className="h-3.5 w-3.5" />}
            {monitor?.paused ? 'Resume' : 'Pause'}
          </button>
          {mailbox ? (
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              title={`Disconnect ${mailbox.address}`}
              className="inline-flex h-9 items-center gap-2 border-2 border-hairline-strong bg-white px-3 text-body-s font-semibold leading-none text-ink transition-all duration-150 hover:border-ink hover:bg-canvas active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Unplug aria-hidden className="h-3.5 w-3.5" />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConnect((value) => !value)}
              aria-expanded={showConnect}
              className="inline-flex h-9 items-center gap-2 border-2 border-structure bg-structure px-3 text-body-s font-semibold leading-none text-white transition-all duration-150 hover:bg-structure-600 active:translate-y-px"
            >
              <Plug aria-hidden className="h-3.5 w-3.5" />
              Connect mailbox
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex h-9 items-center gap-2 border-2 border-ink bg-accent px-3 text-body-s font-semibold leading-none text-accent-ink transition-all duration-150 hover:brightness-95 active:translate-y-px active:brightness-90"
          >
            <Send aria-hidden className="h-3.5 w-3.5" />
            {open ? 'Close injector' : 'Direct mailer'}
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2.5 border-b border-l-3 border-hairline px-5 py-2.5 text-body-s ${
            notice.tone === 'green'
              ? 'border-l-st-green-ink bg-st-green-bg text-st-green-ink'
              : notice.tone === 'amber'
                ? 'border-l-st-amber-ink bg-st-amber-bg text-st-amber-ink'
                : 'border-l-st-red-ink bg-st-red-bg text-st-red-ink'
          }`}
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" title="Dismiss">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ---- Connect a mailbox ---------------------------------------- */}
      {showConnect && !mailbox && (
        <div className="border-b border-hairline px-5 py-5">
          <div className="flex items-start gap-2.5">
            <Link2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-meta" />
            <p className="max-w-[70ch] text-body-s leading-6 text-meta">
              Type the address and an{' '}
              <strong className="font-semibold text-ink">app password</strong> — the server is
              worked out from the domain. The credentials are proved against the mailbox before
              anything is stored, and watching starts at the newest message, so connecting a real
              account never pulls in its history.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
            <Field
              label="Email address"
              hint="Gmail, Outlook, Yahoo and Zoho are recognised by domain."
            >
              <input
                value={mailAddress}
                onChange={(event) => setMailAddress(event.target.value)}
                autoComplete="username"
                placeholder="orders@yourcompany.com"
                className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s text-ink transition-colors duration-150 placeholder:text-meta hover:border-b-ink focus:border-b-ink"
              />
            </Field>

            <Field
              label="App password"
              hint="For Gmail this is a 16-character app password, not the account password."
            >
              <input
                type="password"
                value={appPassword}
                onChange={(event) => setAppPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s text-ink transition-colors duration-150 placeholder:text-meta hover:border-b-ink focus:border-b-ink"
              />
            </Field>

            <Field label="IMAP host" hint="Leave blank to infer it from the address.">
              <input
                value={imapHost}
                onChange={(event) => setImapHost(event.target.value)}
                placeholder="inferred from the domain"
                className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s text-ink transition-colors duration-150 placeholder:text-meta hover:border-b-ink focus:border-b-ink"
              />
            </Field>

            <Field label="Folder">
              <input
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s text-ink transition-colors duration-150 hover:border-b-ink focus:border-b-ink"
              />
            </Field>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={connect}
              disabled={busy || !mailAddress.includes('@') || !appPassword}
              className="inline-flex h-10 items-center gap-2 border-2 border-ink bg-accent px-5 text-body-s font-semibold leading-none text-accent-ink transition-all duration-150 hover:brightness-95 active:translate-y-px active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0"
            >
              <Plug aria-hidden className="h-4 w-4" />
              {busy ? 'Verifying…' : 'Verify & connect'}
            </button>
          </div>
        </div>
      )}

      {/* ---- Direct PO injector -------------------------------------- */}
      {open && (
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Sender" hint="An address outside the whitelist is quarantined at intake.">
              <input
                value={fromAddress}
                onChange={(event) => setFromAddress(event.target.value)}
                className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s text-ink transition-colors duration-150 hover:border-b-ink focus:border-b-ink"
              />
            </Field>
            <Field label="Recipient">
              <input
                value={toAddress}
                onChange={(event) => setToAddress(event.target.value)}
                className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s text-ink transition-colors duration-150 hover:border-b-ink focus:border-b-ink"
              />
            </Field>
            <Field label="Subject" hint="The PO number is read from here, the body, or the filename.">
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s text-ink transition-colors duration-150 hover:border-b-ink focus:border-b-ink"
              />
            </Field>
          </div>

          <div className="space-y-4">
            <Field label="Body">
              <textarea
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                rows={8}
                className="w-full min-w-0 border border-b-2 border-hairline-strong border-b-meta bg-white px-3 py-2 text-body-s leading-6 text-ink transition-colors duration-150 hover:border-b-ink focus:border-b-ink"
              />
            </Field>

            <Field label="Attachment" hint="A PDF raises extraction confidence; a name containing “scan” or “photo” drives the OCR-failure branch.">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept="application/pdf"
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                  className="block w-full text-body-s text-meta file:mr-3 file:border-2 file:border-hairline-strong file:bg-white file:px-3 file:py-1.5 file:text-body-s file:font-semibold file:text-ink hover:file:border-ink"
                />
              </div>
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((file) => (
                    <li key={file.name} className="flex items-center gap-2 text-caption text-meta">
                      <Paperclip aria-hidden className="h-3 w-3 shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="ku-fig">{(file.size / 1024).toFixed(0)} KB</span>
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={send}
                disabled={busy || !subject.trim() || !fromAddress.includes('@')}
                className="inline-flex h-10 items-center gap-2 border-2 border-ink bg-accent px-5 text-body-s font-semibold leading-none text-accent-ink transition-all duration-150 hover:brightness-95 active:translate-y-px active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0"
              >
                <Send aria-hidden className="h-4 w-4" />
                {busy ? 'Injecting…' : 'Inject into pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <label className="block">
    <span className="ku-eyebrow text-ink">{label}</span>
    <div className="mt-1.5">{children}</div>
    {hint && <p className="mt-1.5 text-caption leading-5 text-meta">{hint}</p>}
  </label>
);
