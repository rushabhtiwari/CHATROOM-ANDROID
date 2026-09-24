import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tap } from '~/native/haptics';

/**
 * The frame every screen sits in.
 *
 * One scroll container, one header, and safe-area padding in exactly one
 * place. Screens that manage their own scrolling — the message list, which
 * is virtualised and anchored to the bottom — pass `scroll={false}` and take
 * the body over.
 */
export function Screen({
  title,
  subtitle,
  back,
  action,
  children,
  scroll = true,
  padBottom = true,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Show a back affordance. `true` goes up one entry in history. */
  back?: boolean | (() => void);
  action?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  /** False on screens whose own footer already clears the tab bar. */
  padBottom?: boolean;
}) {
  const navigate = useNavigate();

  const goBack = () => {
    tap();
    if (typeof back === 'function') back();
    else navigate(-1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      {(title || back) && (
        <header className="shrink-0 border-b border-line bg-surface pt-safe-top">
          <div className="flex min-h-[52px] items-center gap-1 px-2">
            {back && (
              <button
                type="button"
                onClick={goBack}
                aria-label="Back"
                className="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-brand active:bg-slate-100"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <div className={cn('min-w-0 flex-1', !back && 'px-2')}>
              {title && (
                <h1 className="truncate text-[17px] font-semibold leading-tight text-ink">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="truncate text-[12px] leading-tight text-slate-500">{subtitle}</p>
              )}
            </div>
            {action && <div className="flex shrink-0 items-center gap-1 pr-1">{action}</div>}
          </div>
        </header>
      )}

      <div
        className={cn(
          'min-h-0 flex-1',
          scroll && 'scroll-y',
          padBottom && 'pb-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom))]',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A grouped list, the way iOS groups settings and records. */
export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-3">
      {title && (
        <h2 className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
      )}
      <div className="divide-y divide-line border-y border-line bg-surface">{children}</div>
    </section>
  );
}

/** A tappable row that meets the 44pt minimum without being told to. */
export function Row({
  onClick,
  children,
  className,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const interactive = Boolean(onClick);
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        interactive
          ? () => {
              tap();
              onClick?.();
            }
          : undefined
      }
      className={cn(
        'flex min-h-touch w-full items-center gap-3 px-4 py-2.5 text-left',
        interactive && 'active:bg-slate-100',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** What a list says when it has nothing in it, rather than nothing at all. */
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="px-8 py-16 text-center">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {detail && <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{detail}</p>}
    </div>
  );
}
