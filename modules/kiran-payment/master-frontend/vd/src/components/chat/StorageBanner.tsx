/**
 * Tells the user when the workspace has stopped saving.
 *
 * Without this the failure is invisible: messages keep sending, the UI keeps
 * working, and the entire session disappears on the next reload. The banner is
 * deliberately loud, offers the one action that actually recovers space, and
 * can be dismissed once the user has understood it.
 */

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useChat } from "@/lib/chat-store";

const formatSize = (bytes: number) =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;

export function StorageBanner() {
  const { showStorageWarning, storageStatus, reclaimAttachmentSpace, dismissStorageWarning } =
    useChat();
  const [clearing, setClearing] = useState(false);

  if (!showStorageWarning) return null;

  const quota = storageStatus.reason === "quota";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs md:px-6"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      <p className="min-w-0 flex-1">
        <b className="font-semibold text-destructive">
          {quota ? "This device is out of space." : "This browser is not saving your workspace."}
        </b>{" "}
        <span className="text-muted-foreground">
          {quota
            ? `Your workspace is ${formatSize(storageStatus.bytes)} and can no longer be saved. New messages will be lost when you reload.`
            : "Storage is blocked — private browsing does this. New messages will be lost when you reload."}
        </span>
      </p>
      {quota && (
        <button
          type="button"
          disabled={clearing}
          onClick={() => {
            setClearing(true);
            void reclaimAttachmentSpace().finally(() => setClearing(false));
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-destructive px-2.5 py-1.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {clearing ? "Clearing…" : "Free up space"}
        </button>
      )}
      <button
        type="button"
        onClick={dismissStorageWarning}
        aria-label="Dismiss storage warning"
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
