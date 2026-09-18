import React from 'react';

interface PageHeaderProps {
  title: string;
  category?: string;
  eyebrow?: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * The spine — LEDGERDESIGNSYSTEM.md §5.1.
 *
 * The rhythm every page inherits: a mono eyebrow, a wide-set title, then a 3px
 * `structure` rule drawn across the full width, with the standfirst below it.
 *
 * The action group is baseline-aligned with the title (`items-end`) and the
 * rule then runs *under both*. That is what makes the header read as one ruled
 * unit rather than a title with a button floating beside it.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  category,
  eyebrow,
  description,
  badge,
  actions,
  toolbar,
  children,
  className = ''
}) => {
  const eyebrowText = category || eyebrow;
  const actionItems = actions || toolbar;

  return (
    <header className={`mb-8 ${className}`}>
      {eyebrowText && <p className="ku-eyebrow mb-2.5">{eyebrowText}</p>}

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="ku-wide max-w-3xl font-display text-h2 font-semibold text-ink lg:text-h1">
            {title}
          </h1>
          {badge}
        </div>

        {actionItems && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">{actionItems}</div>
        )}
      </div>

      {/* The ledger spine — the rule the whole page hangs from. It draws in
          from the left, like a pen across a ledger line. */}
      <div aria-hidden className="mt-4 h-[3px] origin-left animate-rule-in bg-structure" />

      {description && (
        <p className="mt-3 max-w-3xl text-body-s leading-6 text-meta">{description}</p>
      )}

      {children && <div className="mt-5">{children}</div>}
    </header>
  );
};
