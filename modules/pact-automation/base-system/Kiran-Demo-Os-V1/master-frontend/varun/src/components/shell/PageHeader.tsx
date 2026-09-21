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
 * Page header - docs/design-language.md, rule 1: say it once.
 *
 * A page has a title, an optional status badge, and its actions top right. The
 * `category` / `eyebrow` / `description` props are still accepted so call sites
 * keep compiling, but they are deliberately not rendered.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  badge,
  actions,
  toolbar,
  children,
  className = ''
}) => {
  const actionItems = actions || toolbar;

  return (
    <header className={`mb-6 ${className}`}>
      <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-h1 font-semibold text-ink">{title}</h1>
          {badge}
        </div>

        {actionItems && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actionItems}</div>
        )}
      </div>

      {children && <div className="mt-6">{children}</div>}
    </header>
  );
};
