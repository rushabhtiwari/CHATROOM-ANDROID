import React from 'react';

export interface LinearProgressBarProps {
  value?: number; // 0-100
  percentage?: number; // alias for value
  secondaryValue?: number; // 0-100 (in-progress segment)
  secondaryPercentage?: number; // alias for secondaryValue
  label?: string;
  valueLabel?: string;
  fractionLabel?: string;
  detail?: string; // alias for fractionLabel
  showLabels?: boolean;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  heightClass?: string;
  className?: string;
}

export const LinearProgressBar: React.FC<LinearProgressBarProps> = ({
  value,
  percentage,
  secondaryValue = 0,
  secondaryPercentage = 0,
  label,
  valueLabel,
  fractionLabel,
  detail,
  showLabels = true,
  variant = 'primary',
  heightClass = 'h-2',
  className = '',
}) => {
  const primaryRaw = value !== undefined ? value : (percentage !== undefined ? percentage : 0);
  const secondaryRaw = secondaryValue !== 0 ? secondaryValue : secondaryPercentage;

  const clampedPrimary = Math.max(0, Math.min(100, primaryRaw));
  const clampedSecondary = Math.max(0, Math.min(100 - clampedPrimary, secondaryRaw));

  const fraction = fractionLabel || detail;
  const primaryDisplay = valueLabel || `${Math.round(clampedPrimary)}%`;

  const getVariantColor = () => {
    switch (variant) {
      case 'success':
        return 'bg-strand-green';
      case 'warning':
        return 'bg-strand-amber';
      case 'danger':
        return 'bg-strand-red';
      case 'primary':
      default:
        return 'bg-primary';
    }
  };

  const getSecondaryColor = () => {
    switch (variant) {
      case 'warning':
        return 'bg-amber-300';
      case 'danger':
        return 'bg-red-300';
      case 'success':
        return 'bg-emerald-300';
      case 'primary':
      default:
        return 'bg-tertiary-fixed-dim';
    }
  };

  const hasLabelContent = showLabels && (label || valueLabel || fraction || primaryRaw !== undefined);

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {hasLabelContent && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-on-surface-variant font-medium truncate pr-2">{label}</span>}
          <div className="flex items-baseline gap-1.5 ml-auto shrink-0">
            <span className="text-primary font-bold font-mono text-xs">
              {primaryDisplay}
            </span>
            {fraction && (
              <span className="text-outline font-normal font-mono text-[11px]">
                ({fraction})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Track & Fills */}
      <div className={`w-full ${heightClass} rounded-full bg-surface-container overflow-hidden flex`}>
        <div
          className={`h-full ${getVariantColor()} transition-all duration-500`}
          style={{ width: `${clampedPrimary}%` }}
        />
        {clampedSecondary > 0 && (
          <div
            className={`h-full ${getSecondaryColor()} transition-all duration-500`}
            style={{ width: `${clampedSecondary}%` }}
          />
        )}
      </div>
    </div>
  );
};
