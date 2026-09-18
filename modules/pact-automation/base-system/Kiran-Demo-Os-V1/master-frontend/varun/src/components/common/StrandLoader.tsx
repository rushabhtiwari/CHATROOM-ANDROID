import React from 'react';

interface StrandLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export const StrandLoader: React.FC<StrandLoaderProps> = ({
  size = 'md',
  className = '',
  label
}) => {
  const height = size === 'sm' ? 'h-4 w-5' : size === 'lg' ? 'h-8 w-10' : 'h-6 w-7';
  const strandH = size === 'sm' ? 'h-3.5 w-0.5' : size === 'lg' ? 'h-7 w-1' : 'h-5 w-0.5';

  return (
    <div className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}>
      <div className={`relative flex items-end justify-center ${height}`}>
        <div
          className={`absolute bottom-0 rounded-full bg-strand-red animate-fan-1 ${strandH}`}
        />
        <div
          className={`absolute bottom-0 rounded-full bg-strand-amber animate-fan-2 ${strandH}`}
        />
        <div
          className={`absolute bottom-0 rounded-full bg-strand-green animate-fan-3 ${strandH}`}
        />
        <div
          className={`absolute bottom-0 rounded-full bg-strand-teal animate-fan-4 ${strandH}`}
        />
      </div>
      {label && (
        <span className="text-xs font-mono text-muted tracking-tight animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};
