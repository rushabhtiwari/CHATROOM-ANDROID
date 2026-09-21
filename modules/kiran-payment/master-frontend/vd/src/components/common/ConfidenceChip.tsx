import React from 'react';

interface ConfidenceChipProps {
  confidence: number;
  showIcon?: boolean;
  className?: string;
}

/** Same bands as getConfidenceColor (95 / 80), in the tinted status palette. */
const toneFor = (confidence: number) =>
  confidence >= 95
    ? { pill: 'bg-[#E7F3EB] text-[#17723F]', dot: 'bg-[#17723F]' }
    : confidence >= 80
      ? { pill: 'bg-[#FBEFDC] text-[#8A4F00]', dot: 'bg-[#8A4F00]' }
      : { pill: 'bg-[#FBE9E7] text-[#B3302A]', dot: 'bg-[#B3302A]' };

export const ConfidenceChip: React.FC<ConfidenceChipProps> = ({
  confidence,
  showIcon = false,
  className = ''
}) => {
  const tone = toneFor(confidence);

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[12px] font-medium tabular-nums whitespace-nowrap ${tone.pill} ${className}`}
      title={`Confidence: ${confidence}%`}
    >
      {showIcon && <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />}
      <span>{confidence}%</span>
    </span>
  );
};
