import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * A page says what it is once: the title. `description` stays in the props so
 * callers compile, but it is deliberately not rendered.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  badge,
  actions,
  children,
  className = ''
}) => {
  return (
    <div className={`space-y-4 mb-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 min-h-[44px]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-semibold text-[26px] leading-[1.2] text-ink tracking-[-0.02em]">
              {title}
            </h1>
            {badge}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="pt-2">
          {children}
        </div>
      )}
    </div>
  );
};
