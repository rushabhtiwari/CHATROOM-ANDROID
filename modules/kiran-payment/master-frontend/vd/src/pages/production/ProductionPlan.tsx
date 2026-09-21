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

  const onHold = open.filter((o) => o.stage === 'QC Hold').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Production"
        actions={
          <Link to="/projects" className="btn-secondary">
            Projects
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi">
          <div className="kpi-label">Open work orders</div>
          <div className="kpi-value">{open.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Metres planned</div>
          <div className="kpi-value">{planned.toLocaleString('en-IN')}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Metres produced</div>
          <div className="kpi-value">{produced.toLocaleString('en-IN')}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">On QC hold</div>
          <div className={`kpi-value ${onHold > 0 ? 'text-strand-red' : ''}`}>{onHold}</div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg p-5">
        <h3 className="text-[16px] font-semibold text-ink">Lines today</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mt-4">
          {LINES.map((line) => (
            <div key={line.name}>
              <div className="flex items-center justify-between text-[14px]">
                <span className="font-medium text-ink">{line.name}</span>
                <span className="text-muted tabular-nums">{line.load}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#EBEBEF] overflow-hidden mt-2">
                <div className="h-full bg-kiran" style={{ width: `${line.load}%` }} />
              </div>
              <div className="text-[13px] text-muted mt-1.5 truncate">{line.job}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="inline-flex flex-wrap items-center gap-0.5 p-0.5 rounded-lg bg-[#EBEBEF]">
          {STAGES.map((entry) => (
            <button
              key={entry}
              onClick={() => setStage(entry)}
              className={`h-7 px-3 rounded-md text-[13px] font-medium transition-colors ${
                stage === entry ? 'bg-white text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {entry}
            </button>
          ))}
        </div>

        <div className="bg-surface border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface-2 text-[13px] font-medium text-muted border-b border-line">
              <tr>
                <th className="px-4 py-3 font-medium">Work order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Line</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium text-right">Due</th>
                <th className="px-4 py-3 font-medium">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {rows.map((order) => {
                const ratio = order.producedMetres / order.plannedMetres;
                return (
                  <tr key={order.id} className="h-[52px] hover:bg-canvas">
                    <td className="px-4 py-3 font-code text-[13px] text-ink whitespace-nowrap">{order.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{order.customer}</div>
                      <div className="font-code text-[13px] text-muted whitespace-nowrap">{order.poNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.product}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{order.line}</td>
                    <td className="px-4 py-3 min-w-[180px]">
                      <div className="h-1.5 rounded-full bg-[#EBEBEF] overflow-hidden">
                        <div className="h-full bg-kiran" style={{ width: `${Math.round(ratio * 100)}%` }} />
                      </div>
                      <div className="text-[13px] text-muted mt-1 tabular-nums whitespace-nowrap">
                        {order.producedMetres.toLocaleString('en-IN')} / {order.plannedMetres.toLocaleString('en-IN')} m
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{order.due}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusPill status={PILL[order.stage]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
