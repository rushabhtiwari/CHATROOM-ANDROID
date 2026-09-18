import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';

type Stage = 'Planned' | 'In Production' | 'QC Hold' | 'Completed';

interface WorkOrder {
  id: string;
  poNumber: string;
  customer: string;
  product: string;
  line: string;
  plannedMetres: number;
  producedMetres: number;
  due: string;
  stage: Stage;
}

/** Work orders raised against the open sales orders, one row per run. */
const WORK_ORDERS: WorkOrder[] = [
  { id: 'WO-2609-014', poNumber: 'PO-MOTH-2026-881', customer: 'Motherson Sumi Systems Ltd', product: 'Silicone Coated Fiberglass Sleeve 6mm Black', line: 'Braiding Line 2', plannedMetres: 45000, producedMetres: 31500, due: '24 Sep', stage: 'In Production' },
  { id: 'WO-2609-013', poNumber: 'PO-ALST-2026-904', customer: 'Alstom Transport India Ltd', product: 'Class H Varnished Sleeving 4mm Amber', line: 'Varnish Tower 1', plannedMetres: 18000, producedMetres: 18000, due: '20 Sep', stage: 'QC Hold' },
  { id: 'WO-2609-012', poNumber: 'PO-GE-2026-412', customer: 'GE Power India Ltd', product: 'Braided Expandable Sleeving 16mm Black', line: 'Braiding Line 1', plannedMetres: 12000, producedMetres: 4800, due: '29 Sep', stage: 'In Production' },
  { id: 'WO-2609-011', poNumber: 'PO-SUZ-2026-118', customer: 'Suzlon Energy Ltd', product: 'Silicone Coated Fiberglass Sleeve 8mm Black', line: 'Coating Line 3', plannedMetres: 30000, producedMetres: 0, due: '03 Oct', stage: 'Planned' },
  { id: 'WO-2609-010', poNumber: 'PO-MOTH-2026-862', customer: 'Motherson Sumi Systems Ltd', product: 'Fiberglass Sleeving 2.5mm Natural', line: 'Braiding Line 2', plannedMetres: 60000, producedMetres: 60000, due: '15 Sep', stage: 'Completed' },
  { id: 'WO-2609-009', poNumber: 'PO-ALST-2026-897', customer: 'Alstom Transport India Ltd', product: 'Heat-shrink Sleeve 8mm Red', line: 'Extrusion Line 1', plannedMetres: 9000, producedMetres: 9000, due: '12 Sep', stage: 'Completed' },
];

const LINES = [
  { name: 'Braiding Line 1', load: 62, job: 'WO-2609-012' },
  { name: 'Braiding Line 2', load: 88, job: 'WO-2609-014' },
  { name: 'Coating Line 3', load: 35, job: 'Changeover for WO-2609-011' },
  { name: 'Varnish Tower 1', load: 0, job: 'Waiting on QC release' },
  { name: 'Extrusion Line 1', load: 47, job: 'Stock build' },
];

// StatusPill colours by wording, so the stages map onto words it already knows.
const PILL: Record<Stage, string> = {
  Planned: 'Queued',
  'In Production': 'In Production',
  'QC Hold': 'Needs Review',
  Completed: 'Completed',
};

const STAGES: Array<Stage | 'All'> = ['All', 'In Production', 'Planned', 'QC Hold', 'Completed'];

export const ProductionPlan: React.FC = () => {
  const [stage, setStage] = useState<Stage | 'All'>('All');
  const rows = stage === 'All' ? WORK_ORDERS : WORK_ORDERS.filter((order) => order.stage === stage);

  const open = WORK_ORDERS.filter((order) => order.stage !== 'Completed');
  const planned = open.reduce((sum, order) => sum + order.plannedMetres, 0);
  const produced = open.reduce((sum, order) => sum + order.producedMetres, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Production Plan"
        description="Work orders against open sales orders, and what each line is running. A run on QC hold is waiting on the Quality team."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open work orders', value: String(open.length), note: `${WORK_ORDERS.length - open.length} completed this month` },
          { label: 'Metres planned', value: planned.toLocaleString('en-IN'), note: 'Across open work orders' },
          { label: 'Metres produced', value: produced.toLocaleString('en-IN'), note: `${Math.round((produced / planned) * 100)}% of plan` },
          { label: 'On QC hold', value: String(open.filter((o) => o.stage === 'QC Hold').length), note: 'Waiting on Quality' },
        ].map((card) => (
          <div key={card.label} className="p-4 bg-surface border border-line rounded-md shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{card.label}</div>
            <div className="text-2xl font-display font-bold text-ink mt-1 font-mono">{card.value}</div>
            <div className="text-[11px] text-muted mt-1">{card.note}</div>
          </div>
        ))}
      </div>

      {/* Line loading */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-card">
        <h3 className="font-display font-semibold text-sm text-ink border-b border-line pb-3">
          Line loading today
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mt-4">
          {LINES.map((line) => (
            <div key={line.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">{line.name}</span>
                <span className="font-mono text-muted">{line.load}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-canvas border border-line overflow-hidden mt-1.5">
                <div
                  className={`h-full ${line.load > 80 ? 'bg-strand-amber' : 'bg-strand-green'}`}
                  style={{ width: `${line.load}%` }}
                />
              </div>
              <div className="text-[11px] text-muted mt-1 truncate">{line.job}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Work orders */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STAGES.map((entry) => (
            <button
              key={entry}
              onClick={() => setStage(entry)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                stage === entry
                  ? 'bg-kiran text-white border-kiran'
                  : 'bg-surface text-slate-700 border-line hover:border-kiran/40'
              }`}
            >
              {entry}
            </button>
          ))}
        </div>

        <div className="bg-surface border border-line rounded-lg shadow-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
              <tr>
                <th className="p-3 font-semibold">Work order</th>
                <th className="p-3 font-semibold">Customer PO</th>
                <th className="p-3 font-semibold">Product</th>
                <th className="p-3 font-semibold">Line</th>
                <th className="p-3 font-semibold w-[200px]">Progress</th>
                <th className="p-3 font-semibold text-right">Due</th>
                <th className="p-3 font-semibold">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((order) => {
                const ratio = order.producedMetres / order.plannedMetres;
                return (
                  <tr key={order.id}>
                    <td className="p-3 font-mono font-semibold text-kiran">{order.id}</td>
                    <td className="p-3">
                      <div className="font-mono text-ink">{order.poNumber}</div>
                      <div className="text-[11px] text-muted">{order.customer}</div>
                    </td>
                    <td className="p-3 text-slate-700">{order.product}</td>
                    <td className="p-3">{order.line}</td>
                    <td className="p-3">
                      <div className="h-1.5 rounded-full bg-canvas border border-line overflow-hidden">
                        <div className="h-full bg-kiran" style={{ width: `${Math.round(ratio * 100)}%` }} />
                      </div>
                      <div className="text-[10px] font-mono text-muted mt-1">
                        {order.producedMetres.toLocaleString('en-IN')} / {order.plannedMetres.toLocaleString('en-IN')} m
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono">{order.due}</td>
                    <td className="p-3">
                      <StatusPill status={PILL[order.stage]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted">
          Tasks, cycles and ownership for each run are tracked in{' '}
          <Link to="/projects" className="text-kiran hover:underline font-semibold">
            Projects
          </Link>{' '}
          and in Project Management on the rail.
        </p>
      </div>
    </div>
  );
};
