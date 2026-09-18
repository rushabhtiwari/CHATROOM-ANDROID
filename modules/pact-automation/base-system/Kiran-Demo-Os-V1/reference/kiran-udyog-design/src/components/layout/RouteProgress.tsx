// A thin determinate-looking progress bar pinned to the very top of the viewport.
// It eases toward 90% while a route resolves, then snaps to 100% and fades out —
// the standard "the app is working" signal, in the house accent.
//
// design.md §8 asks for restraint: this is the 3px ledger rule, one colour, no bounce.

import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/format';

export function RouteProgress({ active }: { active: boolean }): JSX.Element | null {
  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    clearTimers();

    if (active) {
      setVisible(true);
      setValue(0);
      // Ease toward 90% — never complete until the route actually resolves.
      timers.current.push(window.setTimeout(() => setValue(35), 20));
      timers.current.push(window.setTimeout(() => setValue(65), 180));
      timers.current.push(window.setTimeout(() => setValue(82), 420));
      timers.current.push(window.setTimeout(() => setValue(90), 800));
      return clearTimers;
    }

    if (!visible) return undefined;

    setValue(100);
    timers.current.push(window.setTimeout(() => setVisible(false), 220));
    timers.current.push(window.setTimeout(() => setValue(0), 420));
    return clearTimers;
    // `visible` is intentionally read, not tracked: reacting to it would restart the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent"
    >
      <div
        className={cx(
          'h-full bg-orangy transition-[width,opacity] ease-out',
          value === 100 ? 'opacity-0 duration-200' : 'opacity-100 duration-300',
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
