import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  actions,
  children,
  className = ''
}) => {
  return (
    <div className={`space-y-4 mb-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-semibold text-[26px] leading-[1.15] text-ink tracking-[-0.025em]">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-[13px] text-muted mt-1.5 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
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
