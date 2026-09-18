// Standard page opener, and the rhythm every page inherits: a quiet mono breadcrumb
// trail, the title set wide in the display face, then the ledger spine — a 3px navy
// rule drawn across the full width of the header — with the standfirst beneath it.

import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cx } from '@/lib/format';

export interface Crumb {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps): JSX.Element {
  const crumbs: Crumb[] = breadcrumb && breadcrumb.length > 0 ? breadcrumb : [{ label: title }];

  return (
    <header className={cx('mb-8', className)}>
      {/* A filing path, not a wayfinding widget: mono, slash-separated, low volume. */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="ku-docket flex flex-wrap items-center gap-x-2 gap-y-1">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && (
                  <li aria-hidden="true" className="text-hairline-strong">
                    /
                  </li>
                )}
                <li className="min-w-0">
                  {isLast || !crumb.to ? (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={isLast ? 'text-rich-black' : undefined}
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.to}
                      className="transition-colors duration-150 hover:text-link-on-light"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <h1 className="ku-wide min-w-0 max-w-3xl font-display text-h1 font-semibold text-rich-black">
          {title}
        </h1>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>
        )}
      </div>

      {/* The ledger spine — the rule the whole page hangs from. */}
      <div
        aria-hidden="true"
        className="mt-4 h-[3px] origin-left animate-rule-in bg-darkey-bluey"
      />

      {subtitle && <p className="mt-3 max-w-3xl text-body-s leading-6 text-meta">{subtitle}</p>}
    </header>
  );
}
