/**
 * Filing a reimbursement claim without leaving the conversation.
 *
 * The reason this belongs in the chat and not only on the finance screen: the
 * claim is already a conversation. Someone photographs a fuel bill and sends
 * it to HR. The old shape of that is a message, a portal, a form, and an email
 * saying "filed it". Here the receipt is dropped into the thread addressed to
 * a named reviewer, the reading comes back in a few seconds, the employee
 * corrects what the model got wrong, and one card in the thread carries the
 * claim for the rest of its life.
 *
 * Two things are deliberate. The model's reading is a **proposal** — every
 * field stays editable, and both versions are stored, so a reviewer can see
 * that the amount was changed. And the claim is created by the same API the
 * finance module uses, so nothing about it is special: it appears in HR's
 * queue, in the budget figures and in the payout run exactly as one filed from
 * the portal would.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Paperclip,
  ReceiptText,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { useRts } from '@/modules/rts/store';
import { extractReceipts, type Extraction, type UploadedReceipt } from '@/modules/rts/api';
import { formatCurrency } from '@/modules/rts/format';
import { ALL_CATEGORIES, CATEGORY_LABEL } from '@/modules/rts/status';
import { employeeForName } from '@/modules/rts/identity';
import type { Category } from '@/modules/rts/types';
import { cn } from '@/lib/utils';
import { UserAvatar } from './UserAvatar';

type Phase = 'pick' | 'reading' | 'confirm' | 'filing';

const MAX_FILES = 5;

export interface ClaimComposerProps {
  onClose: () => void;
  /** Called with the new claim's id once the server has created it. */
  onFiled: (claimId: string, reviewerName: string) => void;
}

export const ClaimComposer: React.FC<ClaimComposerProps> = ({ onClose, onFiled }) => {
  const { activeRoom, currentUser, currentUserId, userById } = useChat();
  const { currentEmployee, employees, createRequest } = useRts();

  // The claim belongs to whoever is signed in, not to a fixed demo persona:
  // switching identity in the top bar has to change whose allowance the claim
  // draws against, or the two halves of the console disagree.
  const filer = employeeForName(employees, currentUser.name) ?? currentEmployee;

  const [phase, setPhase] = useState<Phase>('pick');
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState<UploadedReceipt[]>([]);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // The claim, as the employee will submit it. Seeded from the reading.
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('OTHER');
  const [amount, setAmount] = useState('');
  const [justification, setJustification] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  /** Who this claim is being sent to — the other side of a direct message. */
  const reviewer = useMemo(() => {
    if (activeRoom.type !== 'direct') return null;
    const otherId = activeRoom.participantIds.find((id) => id !== currentUserId);
    return otherId ? userById(otherId) : null;
  }, [activeRoom, currentUserId, userById]);

  const addFiles = (incoming: FileList | File[]) => {
    const next = Array.from(incoming).slice(0, MAX_FILES - files.length);
    if (next.length === 0) return;
    setFiles((current) => [...current, ...next]);
    setError(null);
  };

  const read = async () => {
    if (files.length === 0) return;
    setPhase('reading');
    setError(null);
    try {
      const result = await extractReceipts(files);
      setUploaded(result.receipts);
      setExtraction(result.extraction);
      setTitle(result.extraction.title ?? '');
      setCategory((result.extraction.category as Category) ?? 'OTHER');
      setAmount(
        Number.isFinite(result.extraction.amount) ? String(result.extraction.amount) : '',
      );
      setJustification(result.extraction.justification ?? '');
      setPhase('confirm');
    } catch (cause) {
      // Reading is an accelerator, never a gate: if it fails, the claim can
      // still be typed. Saying so is better than a spinner that never ends.
      setError(
        cause instanceof Error
          ? `${cause.message} You can still enter the details yourself.`
          : 'The receipt could not be read. Enter the details yourself.',
      );
      setPhase('confirm');
    }
  };

  const file = async () => {
    const value = Number(amount);
    if (!title.trim() || !Number.isFinite(value) || value <= 0) {
      setError('A claim needs a title and an amount.');
      return;
    }
    setPhase('filing');
    setError(null);
    try {
      const id = await createRequest({
        employeeId: filer.id,
        title: title.trim(),
        category,
        amount: value,
        justification: justification.trim(),
        files: files.map((entry) => ({
          fileName: entry.name,
          sizeKb: Math.round(entry.size / 1024),
        })),
        receiptIds: uploaded.map((receipt) => receipt.id),
        extraction,
        status: 'SUBMITTED',
        actor: filer.name,
      });
      onFiled(id, reviewer?.name ?? 'the reviewer');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The claim could not be filed.');
      setPhase('confirm');
    }
  };

  /* ------------------------------- rendering ------------------------------ */

  const changedFromReading =
    extraction !== null &&
    (Number(amount) !== extraction.amount ||
      title.trim() !== (extraction.title ?? '').trim() ||
      category !== extraction.category);

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-line bg-surface shadow-raised">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
        <ReceiptText className="h-3.5 w-3.5 shrink-0 text-strand-green" />
        <p className="flex-1 text-[12px] font-semibold text-ink">
          Reimbursement claim
          {reviewer && (
            <span className="ml-1 font-normal text-muted">to {reviewer.name}</span>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel this claim"
          className="rounded p-1 text-muted transition-colors hover:bg-line-2 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ------------------------------ pick ------------------------------ */}
      {phase === 'pick' && (
        <div className="p-3">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
            className={cn(
              'rounded-md border border-dashed px-4 py-6 text-center transition-colors',
              dragging ? 'border-kiran bg-kiran-tint' : 'border-slate-300 bg-surface-2',
            )}
          >
            <Upload className="mx-auto h-5 w-5 text-muted" />
            <p className="mt-2 text-[12.5px] font-medium text-ink">
              Drop the receipt here, or
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="ml-1 text-kiran underline underline-offset-2"
              >
                choose a file
              </button>
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              Photographs and PDFs. Up to {MAX_FILES}.
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((entry, index) => (
                <li
                  key={`${entry.name}-${index}`}
                  className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2 py-1.5"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">
                    {entry.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">
                    {Math.round(entry.size / 1024)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Remove ${entry.name}`}
                    className="shrink-0 rounded p-0.5 text-muted transition-colors hover:text-strand-red"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPhase('confirm')}
              className="text-[11px] font-medium text-muted transition-colors hover:text-ink"
            >
              Enter it manually
            </button>
            <button
              type="button"
              onClick={read}
              disabled={files.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-kiran px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-xs transition-colors hover:bg-kiran-600 disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" /> Read the receipt
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------- reading ---------------------------- */}
      {phase === 'reading' && (
        <div className="flex items-center gap-2.5 px-3 py-6">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ai" />
          <div>
            <p className="text-[12.5px] font-medium text-ink">Reading the receipt</p>
            <p className="text-[11px] text-muted">
              Pulling out the vendor, the date and the amount.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------ confirm and file ------------------------ */}
      {(phase === 'confirm' || phase === 'filing') && (
        <div className="space-y-2.5 p-3">
          {extraction && (
            <div className="flex items-start gap-2 rounded-md border border-ai/20 bg-ai-tint px-2.5 py-2">
              <Sparkles className="mt-px h-3 w-3 shrink-0 text-ai" />
              <p className="text-[11px] leading-relaxed text-ai">
                This is what the receipt says. Correct anything that is wrong — your version is
                what gets filed.
              </p>
            </div>
          )}

          <div>
            <label className="label-eyebrow" htmlFor="claim-title">
              What is it for
            </label>
            <input
              id="claim-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Client visit — Pune, 3 days"
              className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px] placeholder:text-muted focus:border-kiran focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label-eyebrow" htmlFor="claim-amount">
                Amount
              </label>
              <input
                id="claim-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0"
                className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[12.5px] placeholder:text-muted focus:border-kiran focus:outline-none"
              />
            </div>
            <div>
              <label className="label-eyebrow" htmlFor="claim-category">
                Category
              </label>
              <select
                id="claim-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as Category)}
                className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[12.5px] focus:border-kiran focus:outline-none"
              >
                {ALL_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label-eyebrow" htmlFor="claim-note">
              Note for the reviewer
            </label>
            <textarea
              id="claim-note"
              rows={2}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Why this was necessary"
              className="mt-1 w-full resize-none rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px] placeholder:text-muted focus:border-kiran focus:outline-none"
            />
          </div>

          {extraction?.policyFindings && extraction.policyFindings.length > 0 && (
            <div className="space-y-1">
              {extraction.policyFindings.map((finding, index) => (
                <p
                  key={index}
                  className="flex items-start gap-1.5 rounded-md bg-strand-amber/10 px-2 py-1.5 text-[10.5px] leading-relaxed text-strand-amber"
                >
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                  {finding.message}
                </p>
              ))}
            </div>
          )}

          {changedFromReading && (
            <p className="text-[10.5px] text-muted">
              Your figures differ from the receipt. Both are kept, so the reviewer can see the
              change.
            </p>
          )}

          {files.length > 0 && (
            <p className="flex items-center gap-1.5 text-[10.5px] text-muted">
              <Paperclip className="h-3 w-3" />
              {files.length} receipt{files.length === 1 ? '' : 's'} attached
            </p>
          )}

          {error && <p className="text-[11px] text-strand-red">{error}</p>}

          <div className="flex items-center justify-between pt-0.5">
            <span className="font-mono text-[13px] font-semibold text-ink">
              {Number(amount) > 0 ? formatCurrency(Number(amount)) : '—'}
            </span>
            <button
              type="button"
              onClick={file}
              disabled={phase === 'filing' || !title.trim() || !(Number(amount) > 0)}
              className="inline-flex items-center gap-1.5 rounded-md bg-kiran px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-xs transition-colors hover:bg-kiran-600 disabled:opacity-40"
            >
              {phase === 'filing' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {reviewer ? `Send to ${reviewer.name.split(' ')[0]}` : 'File the claim'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimComposer;
