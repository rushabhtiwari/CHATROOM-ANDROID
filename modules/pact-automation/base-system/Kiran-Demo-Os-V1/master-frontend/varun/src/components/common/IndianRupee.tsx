import React from 'react';
import { formatINR, formatINRLakhCrore } from '../../utils/formatters';

interface IndianRupeeProps {
  amount: number | undefined | null;
  short?: boolean;
  className?: string;
  isNegativeRed?: boolean;
}

export const IndianRupee: React.FC<IndianRupeeProps> = ({
  amount,
  short = false,
  className = '',
  isNegativeRed = true
}) => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return <span className={`font-mono ${className}`}>₹0</span>;
  }

  const isNegative = amount < 0;
  const formatted = short ? formatINRLakhCrore(amount) : formatINR(amount);

  return (
    <span
      className={`font-mono ${
        isNegative && isNegativeRed ? 'text-strand-red' : ''
      } ${className}`}
    >
      {formatted}
    </span>
  );
};
