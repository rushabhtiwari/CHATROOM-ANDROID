import { AlertTriangle } from 'lucide-react';
import { useDeviceStorageFailing } from '~/lib/useDeviceStorage';

/**
 * Shown while saves are not reaching the phone.
 *
 * Everything still works for this session — the app keeps its data in memory
 * — but anything written now would be gone after a restart, and that is worth
 * saying where people are writing rather than only on the Me screen.
 */
export function StorageWarning() {
  const failing = useDeviceStorageFailing();
  if (!failing) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 bg-strand-amber/10 px-4 py-2 text-[13px] leading-snug text-strand-amber"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        This phone is not saving new messages. They will be lost if the app is closed. Free some
        space, then reopen the app.
      </span>
    </div>
  );
}
