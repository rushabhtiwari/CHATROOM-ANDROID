import React from 'react';
import { getConfidenceColor } from '../../utils/formatters';

interface ConfidenceChipProps {
  confidence: number;
  showIcon?: boolean;
  className?: string;
}

/**
 * An AI extraction confidence, stamped. The reading is a figure, so it is set
 * in the instrument voice; the outline and the letters share one ink.
 */
export const ConfidenceChip: React.FC<ConfidenceChipProps> = ({
  confidence,
  className = ''
}) => {
  const { text, border } = getConfidenceColor(confidence);

  return (
    <span
      className={`ku-stamp tnum ${border} ${text} ${className}`}
      title={`AI Extraction Confidence: ${confidence}%`}
    >
      {confidence}%
    </span>
  );
};
