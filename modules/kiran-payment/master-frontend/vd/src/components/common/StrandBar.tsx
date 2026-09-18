import React, { useState } from 'react';

export interface StrandSegment {
  id: string;
  name: string;
  count: number;
  avgDwellDays: number;
  slaLimitDays: number;
  department: 'Sales' | 'Purchase' | 'Accounts' | 'Projects' | 'Production' | 'Dispatch';
  color: string; // e.g. '#B5070E', '#E9991B', '#018F3D', '#00AEEF'
}

interface StrandBarProps {
  segments?: StrandSegment[];
  className?: string;
  showDetails?: boolean;
}

export const defaultLifecycleSegments: StrandSegment[] = [
  { id: 'email', name: 'Email received', count: 14, avgDwellDays: 0.2, slaLimitDays: 0.5, department: 'Sales', color: '#B5070E' },
  { id: 'rfq', name: 'RFQ raised', count: 28, avgDwellDays: 1.8, slaLimitDays: 2.0, department: 'Sales', color: '#B5070E' },
  { id: 'quote', name: 'Quoted', count: 19, avgDwellDays: 3.4, slaLimitDays: 3.0, department: 'Sales', color: '#B5070E' }, // Over SLA!
  { id: 'po', name: 'PO received', count: 16, avgDwellDays: 0.8, slaLimitDays: 1.0, department: 'Sales', color: '#B5070E' },
  { id: 'workorder', name: 'Work order', count: 12, avgDwellDays: 1.1, slaLimitDays: 1.5, department: 'Production', color: '#E9991B' },
  { id: 'prod', name: 'In production', count: 24, avgDwellDays: 6.8, slaLimitDays: 5.0, department: 'Production', color: '#E9991B' }, // Over SLA!
  { id: 'dispatch', name: 'Dispatched', count: 15, avgDwellDays: 1.2, slaLimitDays: 2.0, department: 'Dispatch', color: '#B5070E' },
  { id: 'pod', name: 'POD pending', count: 9, avgDwellDays: 4.6, slaLimitDays: 3.0, department: 'Dispatch', color: '#B5070E' }, // Over SLA!
  { id: 'closed', name: 'Closed', count: 188, avgDwellDays: 0.0, slaLimitDays: 0.0, department: 'Accounts', color: '#018F3D' },
];

export const StrandBar: React.FC<StrandBarProps> = ({
  segments = defaultLifecycleSegments,
  className = '',
  showDetails = true
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<StrandSegment | null>(null);

  const totalCount = segments.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className={`w-full bg-surface border border-line rounded-lg p-4 shadow-card ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink">Order Lifecycle Pipeline</span>
          <span className="text-xs font-mono text-muted">({totalCount} active operations)</span>
        </div>
        {hoveredSegment ? (
          <div className="text-xs flex items-center gap-3 animate-fadeIn">
            <span className="font-medium text-ink flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredSegment.color }} />
              {hoveredSegment.name}: <strong className="font-mono">{hoveredSegment.count} records</strong>
            </span>
            <span className={`font-mono text-[11px] ${hoveredSegment.avgDwellDays > hoveredSegment.slaLimitDays && hoveredSegment.slaLimitDays > 0 ? 'text-strand-red font-semibold' : 'text-muted'}`}>
              Avg dwell: {hoveredSegment.avgDwellDays}d (SLA: {hoveredSegment.slaLimitDays}d)
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted">Hover segments to inspect dwell time & SLAs</span>
        )}
      </div>

      {/* Multi-segment Strand Bar */}
      <div className="w-full h-3.5 bg-line/40 rounded-sm overflow-hidden flex items-center p-0.5 gap-0.5 border border-line">
        {segments.map((seg) => {
          const widthPct = Math.max(3, (seg.count / totalCount) * 100);
          const isOverSLA = seg.avgDwellDays > seg.slaLimitDays && seg.slaLimitDays > 0;
          return (
            <div
              key={seg.id}
              style={{ width: `${widthPct}%`, backgroundColor: seg.color }}
              className={`h-full rounded-xs transition-all cursor-pointer hover:opacity-90 relative ${
                isOverSLA ? 'ring-1 ring-strand-red' : ''
              }`}
              onMouseEnter={() => setHoveredSegment(seg)}
              onMouseLeave={() => setHoveredSegment(null)}
            />
          );
        })}
      </div>

      {/* Stage Labels */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-line/60 text-[10px] text-muted overflow-x-auto gap-2">
        {segments.slice(0, 8).map((seg) => (
          <div key={seg.id} className="flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="truncate">{seg.name}</span>
            <span className="font-mono font-semibold text-ink">({seg.count})</span>
          </div>
        ))}
      </div>

      {/* Risk Callouts if dwell exceeds SLA */}
      {showDetails && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-line/40">
          <div className="flex items-center gap-2 p-1.5 rounded bg-red-50/50 border border-red-200/60 text-xs text-red-900">
            <span className="w-1.5 h-1.5 rounded-full bg-strand-red shrink-0" />
            <span><strong>Quoting stage</strong> dwell at 3.4d vs 3.0d SLA limit</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded bg-amber-50/50 border border-amber-200/60 text-xs text-amber-900">
            <span className="w-1.5 h-1.5 rounded-full bg-strand-amber shrink-0" />
            <span><strong>In Production</strong> dwell at 6.8d vs 5.0d SLA target</span>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded bg-red-50/50 border border-red-200/60 text-xs text-red-900">
            <span className="w-1.5 h-1.5 rounded-full bg-strand-red shrink-0" />
            <span><strong>POD pending</strong> dwell at 4.6d across 9 shipments</span>
          </div>
        </div>
      )}
    </div>
  );
};
