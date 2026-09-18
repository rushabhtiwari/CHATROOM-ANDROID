import React from 'react';
import { Link } from 'react-router-dom';
import { HealthPill, HealthStatus } from './HealthPill';
import { TONE, Tone } from '../../lib/tone';

export interface KPITrend {
  value: string;
  positive?: boolean;
  isPositive?: boolean;
  neutral?: boolean;
  isNeutral?: boolean;
}

export interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode | React.ElementType;
  badge?: React.ReactNode;
  status?: HealthStatus;
  trend?: KPITrend;
  /**
   * Give a whole band ONE tone. Spend a second colour only on the cell that is
   * genuinely exceptional — the one figure the reader should act on.
   */
  tone?: Tone;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  className?: string;
}

const BandContext = React.createContext(false);

/**
 * A ledger band — LEDGERDESIGNSYSTEM.md §5.2.
 *
 * N related numbers are ONE bordered box divided by hairlines, not N floating
 * cards in a `gap-4` grid. That gap is the single most template-looking thing
 * you can put on a page, so this welds the cells instead.
 *
 *   <LedgerBand cols={4}>
 *     <KPICard … /> <KPICard … />
 *   </LedgerBand>
 */
export const LedgerBand: React.FC<{
  cols?: 2 | 3 | 4 | 5;
  children: React.ReactNode;
  className?: string;
}> = ({ cols = 4, children, className = '' }) => {
  const columns = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
  }[cols];

  return (
    <BandContext.Provider value={true}>
      <div className={`ku-ledger ${columns} ${className}`}>{children}</div>
    </BandContext.Provider>
  );
};

/**
 * One cell of the band.
 *
 * The only colour in a cell is the 3px rule on its top edge. No tinted icon
 * tiles, no coloured grounds, no chips. Two details carry the row:
 *
 *   - `min-h-7` on the eyebrow reserves two lines, so every figure across the
 *     band lands on one shared baseline even when a single label wraps.
 *   - The figure steps down as columns get tighter (`text-h2` → `xl:text-figure`),
 *     because a ten-character amount at 34px in a 4-up band collides with the
 *     hairline.
 *
 * A cell brings no border of its own inside a `LedgerBand` — the band rules it.
 * Standing alone in a page grid it rules itself, so it still reads as a sheet
 * on the canvas rather than a floating block.
 */
export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon,
  badge,
  status,
  trend,
  tone,
  footerLeft,
  footerRight,
  to,
  onClick,
  className = '',
}) => {
  // A cell inside a band is ruled by the band; one standing on its own in a
  // page grid rules itself, so it still reads as a sheet on the canvas.
  const inBand = React.useContext(BandContext);

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComponent = icon as React.ElementType;
    return <IconComponent className="h-3.5 w-3.5 shrink-0 text-hairline-strong" />;
  };

  const isPositiveTrend = trend?.positive ?? trend?.isPositive;
  const isNeutralTrend = trend?.neutral ?? trend?.isNeutral;
  const interactive = Boolean(to || onClick);

  const cardContent = (
    <div
      onClick={onClick}
      className={`group relative flex min-w-0 flex-col px-4 py-4 transition-colors duration-150 sm:px-5 ${
        inBand ? 'bg-white' : 'border border-hairline bg-white'
      } ${interactive ? 'cursor-pointer select-none hover:bg-canvas' : ''} ${className}`}
    >
      {/* The cap. It draws in from the left like a pen across a ledger line. */}
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 origin-left animate-rule-in border-t-3 ${
          tone ? TONE[tone].rule : 'border-t-structure'
        }`}
      />

      <div className="flex items-start justify-between gap-2">
        <p className="ku-eyebrow min-h-7 min-w-0 flex-1">{title}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge}
          {!badge && status && <HealthPill status={status} />}
          {renderIcon()}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="ku-total text-h2 leading-none tracking-tighter xl:text-figure">
          {value}
        </span>
        {unit && <span className="text-caption font-medium text-meta">{unit}</span>}
        {subtitle && !unit && <span className="text-caption text-meta">{subtitle}</span>}
        {trend && (
          /* §8.3 colour is never the only carrier: the direction ships as a
             glyph and an sr-only word alongside the ink. */
          <span
            className={`ku-fig ml-auto shrink-0 text-caption font-semibold ${
              isNeutralTrend
                ? 'text-meta'
                : isPositiveTrend
                ? 'text-st-green-ink'
                : 'text-st-red-ink'
            }`}
          >
            {!isNeutralTrend && (
              <>
                <span aria-hidden>{isPositiveTrend ? '↑' : '↓'} </span>
                <span className="sr-only">{isPositiveTrend ? 'up' : 'down'} </span>
              </>
            )}
            {trend.value}
          </span>
        )}
      </div>

      {(footerLeft || footerRight || (subtitle && unit)) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-caption text-meta">
          <div className="min-w-0 truncate">
            {footerLeft || (subtitle && unit ? subtitle : null)}
          </div>
          {footerRight && <div className="ku-fig shrink-0">{footerRight}</div>}
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block text-left no-underline">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
};
