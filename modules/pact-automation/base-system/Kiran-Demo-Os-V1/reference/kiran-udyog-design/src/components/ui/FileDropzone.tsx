import { useEffect, useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import type { ReceiptFile } from '@/lib/types';
import { cx, formatDate, formatFileSize } from '@/lib/format';

/**
 * The receipt intake tray. Browsing and drag-drop both work and report the real file
 * names and sizes the user picked — but nothing is uploaded or read from disk, because
 * there is no backend. Attached files are owned by the caller.
 */
export function FileDropzone({
  files,
  onRemove,
  onAdd,
  hint = 'PDF, JPG or PNG — up to 10 MB per file',
}: {
  files: { id: string; fileName: string; sizeKb: number }[];
  onRemove?: (id: string) => void;
  onAdd?: (files: { fileName: string; sizeKb: number }[]) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (list: FileList | null) => {
    if (!list || !onAdd) return;
    onAdd(
      Array.from(list).map((f) => ({
        fileName: f.name,
        sizeKb: Math.max(1, Math.round(f.size / 1024)),
      })),
    );
  };

  const totalKb = files.reduce((sum, f) => sum + f.sizeKb, 0);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(e) => {
          accept(e.target.files);
          // Reset so picking the same file twice still fires a change.
          e.target.value = '';
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
        className={cx(
          'border border-dashed px-5 py-7 text-center transition-colors duration-150',
          dragging ? 'border-orangy bg-orangy/5' : 'border-hairline-strong bg-white hover:border-orangy',
        )}
      >
        <p className="ku-eyebrow">Receipt intake</p>
        <p className="mt-2 text-body text-rich-black">
          Drop receipts here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-link-on-light underline underline-offset-2 transition-colors duration-150 hover:text-rich-black"
          >
            choose files
          </button>
        </p>
        <p className="ku-fig mt-2 text-caption text-meta">{hint}</p>
      </div>

      {files.length > 0 && (
        <div className="mt-3 border border-hairline bg-white">
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-hairline px-3 py-2">
            <span className="ku-eyebrow">Attached</span>
            <span className="ku-fig text-caption text-meta">
              {files.length} {files.length === 1 ? 'file' : 'files'} · {formatFileSize(totalKb)}
            </span>
          </div>

          <ul className="ku-ruled">
            {files.map((file, i) => (
              <li key={file.id} className="flex items-center gap-3 px-3 py-2">
                <span className="ku-fig w-5 shrink-0 text-micro text-meta">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-meta" />
                <span
                  className="min-w-0 flex-1 truncate text-body-s text-rich-black"
                  title={file.fileName}
                >
                  {file.fileName}
                </span>
                <span className="ku-fig shrink-0 text-caption text-meta">
                  {formatFileSize(file.sizeKb)}
                </span>
                {onRemove && (
                  <IconButton
                    icon={X}
                    label={`Detach ${file.fileName}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemove(file.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

/**
 * Attached receipts as filed sheets. There are no real images in the demo build, so each
 * tile is a ruled plate with the file's own figures underneath.
 */
export function ReceiptGrid({
  receipts,
  onPreview,
  columns = 3,
}: {
  receipts: ReceiptFile[];
  onPreview?: (receipt: ReceiptFile) => void;
  columns?: number;
}) {
  if (receipts.length === 0) return null;

  return (
    <div className={cx('grid gap-3', GRID_COLS[columns] ?? GRID_COLS[3])}>
      {receipts.map((receipt) => (
        <button
          key={receipt.id}
          type="button"
          onClick={() => onPreview?.(receipt)}
          className="group border border-hairline bg-white text-left transition-colors duration-150 hover:border-darkey-bluey"
        >
          <div className="flex aspect-[4/3] items-center justify-center border-b border-hairline bg-canvas">
            <FileText
              aria-hidden="true"
              className="h-8 w-8 text-hairline-strong transition-colors duration-150 group-hover:text-meta"
            />
          </div>
          <div className="px-2.5 py-2">
            <p
              className="truncate text-body-s font-semibold text-rich-black"
              title={receipt.fileName}
            >
              {receipt.fileName}
            </p>
            <p className="ku-fig mt-0.5 text-caption text-meta">
              {formatFileSize(receipt.sizeKb)} · {formatDate(receipt.uploadedOn)}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

export function ReceiptLightbox({
  receipt,
  onClose,
}: {
  receipt: ReceiptFile | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!receipt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [receipt, onClose]);

  if (!receipt) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rich-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt ${receipt.fileName}`}
        className="ku-sheet flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div className="min-w-0">
            <p className="ku-eyebrow">Attached receipt</p>
            <p className="mt-1 truncate text-body font-semibold text-rich-black">
              {receipt.fileName}
            </p>
          </div>
          <IconButton icon={X} label="Close receipt" variant="ghost" size="sm" onClick={onClose} />
        </div>

        {/*
          The plate sizes itself off its own padding and then gives way: on a short window
          — a phone held sideways — it shrinks and scrolls instead of pushing the head, and
          the only close control on it, off the top of the screen.
        */}
        <div className="ku-scrollbar flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto bg-canvas px-6 py-14">
          <FileText aria-hidden="true" className="h-12 w-12 shrink-0 text-hairline-strong" />
          <p className="max-w-xs text-center text-body-s text-meta">
            The demo build does not render receipt scans. The file stays attached to the claim.
          </p>
        </div>

        <div className="shrink-0 border-t border-hairline px-4 py-3 text-caption text-meta">
          <span className="ku-fig">{formatFileSize(receipt.sizeKb)}</span> · uploaded{' '}
          <span className="ku-fig">{formatDate(receipt.uploadedOn)}</span>
        </div>
      </div>
    </div>
  );
}
