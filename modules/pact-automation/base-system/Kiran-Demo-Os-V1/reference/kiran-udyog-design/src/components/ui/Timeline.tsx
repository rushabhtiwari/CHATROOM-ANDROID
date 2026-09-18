import type { TimelineEvent } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/status';
import { cx, formatDateTime, formatRelative } from '@/lib/format';

/** `14 Aug 2026, 4:20 PM` -> `['14 Aug 2026', '4:20 PM']`. */
function splitStamp(at: string): [string, string] {
  const [date, time] = formatDateTime(at).split(', ');
  return [date, time ?? ''];
}

/**
 * The audit trail, ruled like a ledger: the stamp sits in a left rail set in the figure
 * face, a hairline spine divides it from the entry, and each entry is one actor and one
 * action in plain sentence case with the comment quoted quietly underneath. No bubbles,
 * no avatars — this is a record of who did what, not a chat.
 *
 * The row is a wrapping flex line rather than a fixed grid track, because the hosts vary
 * from a 750px review drawer to the narrow right rail on the claim page. While the entry
 * can hold its 10rem basis beside the stamp the two sit side by side; below that the
 * stamp wraps above the entry and the spine keeps running down the entry, so the trail
 * never squeezes down to a few characters a line — and never pushes its host wide.
 */
export function Timeline({
  events,
  className,
}: {
  events: TimelineEvent[];
  className?: string;
}) {
  if (events.length === 0) return null;

  return (
    <ol className={cx('relative', className)}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const [date, time] = splitStamp(event.at);

        return (
          <li key={event.id} className="flex flex-wrap gap-y-1">
            {/* Left rail: the stamp, in the figure face, ranged right against the spine. */}
            <div className="w-24 shrink-0 pr-3 text-right" title={formatRelative(event.at)}>
              <p className="ku-fig text-caption leading-5 text-rich-black">{date}</p>
              <p className="ku-fig text-micro text-meta">{time}</p>
            </div>

            {/* The entry, hung off the spine it carries on its own left edge. */}
            <div
              className={cx(
                'relative min-w-0 shrink grow basis-40 border-l border-hairline pl-4',
                isLast ? 'pb-0' : 'pb-5',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'absolute -left-[3px] top-[7px] h-1.5 w-1.5',
                  isLast ? 'bg-orangy' : 'bg-darkey-bluey',
                )}
              />

              <p className="flex flex-wrap items-baseline gap-x-2 leading-5">
                <span className="text-body-s font-semibold text-rich-black">{event.actor}</span>
                <span className="ku-eyebrow">{ROLE_LABEL[event.role]}</span>
              </p>

              <p className="mt-0.5 text-body-s text-light-black">{event.action}</p>

              {event.comment && (
                <p className="mt-2 border-l border-hairline-strong pl-3 text-body-s italic text-meta">
                  &ldquo;{event.comment}&rdquo;
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
