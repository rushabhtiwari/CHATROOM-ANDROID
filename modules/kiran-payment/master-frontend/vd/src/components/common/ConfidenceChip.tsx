import React from 'react';
import { getConfidenceColor } from '../../utils/formatters';

interface ConfidenceChipProps {
  confidence: number;
  showIcon?: boolean;
  className?: string;
}

export const ConfidenceChip: React.FC<ConfidenceChipProps> = ({
  confidence,
  showIcon = false,
  className = ''
}) => {
  const { text, bg, border, dot } = getConfidenceColor(confidence);

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-badge text-[11px] font-mono font-medium border ${bg} ${text} ${border} ${className}`}
      title={`AI Extraction Confidence: ${confidence}%`}
    >
      {showIcon && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      <span>{confidence}%</span>
    </span>
  );
};
