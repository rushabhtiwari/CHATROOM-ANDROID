// Shown while a lazily-loaded route resolves. The ledger draws itself in: the rules land
// first, then the figures fill. The shape matches what is arriving, so nothing jumps when
// the real page lands.

import { Skeleton } from '@/components/ui/Skeleton';

const CELLS = [0, 1, 2, 3];
const ROWS = [0, 1, 2, 3, 4, 5];

export function PageLoader(): JSX.Element {
  return (
    <div className="animate-fade-rise space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      {/* Page head — the title rule draws across before anything else arrives. */}
      <div>
        <p aria-hidden="true" className="ku-eyebrow">
          Loading
        </p>
        <Skeleton className="mt-2 h-7 w-64 max-w-full" />
        <div
          aria-hidden="true"
          className="mt-4 h-[3px] w-full origin-left animate-rule-in bg-darkey-bluey"
        />
        <Skeleton className="mt-4 h-3 w-80 max-w-full" />
      </div>

      {/* The ledger band: one ruled surface, four cells, not four floating boxes. */}
      <div className="ku-ledger grid-cols-1 md:grid-cols-4">
        {CELLS.map((i) => (
          <div key={i} className="p-4">
            <div
              aria-hidden="true"
              className="h-[3px] w-full origin-left animate-rule-in bg-hairline-strong"
            />
            <Skeleton className="mt-3 h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-28" />
            <Skeleton className="mt-3 h-3 w-16" />
          </div>
        ))}
      </div>

      {/* The sheet: ruled head, ruled rows, ~44px each. */}
      <div className="ku-sheet">
        <div className="flex items-center justify-between gap-4 border-b-2 border-hairline px-5 py-3.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="ku-ruled">
          {ROWS.map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
              <Skeleton className="ml-auto h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
