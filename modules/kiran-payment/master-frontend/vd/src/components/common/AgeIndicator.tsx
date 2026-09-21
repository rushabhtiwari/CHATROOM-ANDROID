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

  // Neutral until the age becomes a problem
  let segmentColor = 'bg-slate-400';
  let textColor = 'text-muted';

  if (percentage >= 100) {
    segmentColor = 'bg-strand-red';
    textColor = 'text-strand-red font-medium';
  } else if (percentage >= 70) {
    segmentColor = 'bg-strand-amber';
    textColor = 'text-[#8A4F00] font-medium';
  }

  // 4 segments
  const activeSegments = Math.min(4, Math.ceil((percentage / 100) * 4));

  return (
    <div className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`} title={`${daysInStage} of ${slaLimitDays} days`}>
      <span className={`text-[13px] tabular-nums ${textColor}`}>
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
