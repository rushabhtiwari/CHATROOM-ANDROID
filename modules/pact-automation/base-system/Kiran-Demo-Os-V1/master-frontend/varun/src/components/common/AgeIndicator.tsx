import React from 'react';

interface AgeIndicatorProps {
  daysInStage: number;
  slaLimitDays?: number;
  className?: string;
}

export const AgeIndicator: React.FC<AgeIndicatorProps> = ({
  daysInStage,
  slaLimitDays = 4,
  className = ''
}) => {
  const percentage = Math.min(100, Math.round((daysInStage / slaLimitDays) * 100));

  // Determine segment color based on consumption
  let segmentColor = 'bg-strand-green';
  let textColor = 'text-slate';

  if (percentage >= 100) {
    segmentColor = 'bg-strand-red';
    textColor = 'text-strand-red font-semibold';
  } else if (percentage >= 70) {
    segmentColor = 'bg-strand-amber';
    textColor = 'text-strand-amber font-semibold';
  }

  // 4 segments
  const activeSegments = Math.min(4, Math.ceil((percentage / 100) * 4));

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`} title={`${daysInStage} of ${slaLimitDays} days SLA consumed (${percentage}%)`}>
      <span className={`font-mono text-xs ${textColor}`}>
        {daysInStage}d
      </span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className={`w-1 h-3 rounded-xs transition-colors ${
              seg <= activeSegments ? segmentColor : 'bg-line'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
