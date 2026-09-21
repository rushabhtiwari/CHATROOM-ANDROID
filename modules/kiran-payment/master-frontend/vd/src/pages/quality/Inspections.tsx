import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';

type Kind = 'Incoming' | 'In-process' | 'Final';
type Result = 'Pending' | 'Accepted' | 'Rejected';

interface Inspection {
  id: string;
  kind: Kind;
  reference: string;
  item: string;
  source: string;
  sampleSize: number;
  defects: number;
  checks: string;
  result: Result;
}

const SEED: Inspection[] = [
  { id: 'QC-2609-031', kind: 'Final', reference: 'WO-2609-013', item: 'Class H Varnished Sleeving 4mm Amber', source: 'Varnish Tower 1', sampleSize: 32, defects: 0, checks: 'Dielectric 7 kV, bore, wall thickness', result: 'Pending' },
  { id: 'QC-2609-030', kind: 'Incoming', reference: 'GRN-2609-118', item: 'E-Glass Yarn 136 Tex', source: 'Owens Corning India', sampleSize: 20, defects: 1, checks: 'Tex count, moisture, tensile', result: 'Pending' },
  { id: 'QC-2609-029', kind: 'In-process', reference: 'WO-2609-014', item: 'Silicone Coated Fiberglass Sleeve 6mm Black', source: 'Braiding Line 2', sampleSize: 15, defects: 0, checks: 'Coating weight, flexibility at -40 C', result: 'Pending' },
  { id: 'QC-2609-028', kind: 'Incoming', reference: 'GRN-2609-115', item: 'Silicone Rubber Compound Grade A', source: 'Wacker Chemie India', sampleSize: 8, defects: 3, checks: 'Shore A hardness, cure time', result: 'Rejected' },
  { id: 'QC-2609-027', kind: 'Final', reference: 'WO-2609-010', item: 'Fiberglass Sleeving 2.5mm Natural', source: 'Braiding Line 2', sampleSize: 50, defects: 0, checks: 'Bore, fray resistance, length per spool', result: 'Accepted' },
  { id: 'QC-2609-026', kind: 'Final', reference: 'WO-2609-009', item: 'Heat-shrink Sleeve 8mm Red', source: 'Extrusion Line 1', sampleSize: 24, defects: 1, checks: 'Shrink ratio 2:1, recovery temperature', result: 'Accepted' },
];

const KINDS: Array<Kind | 'All'> = ['All', 'Incoming', 'In-process', 'Final'];

/** The inspection queue: incoming material, in-process checks and final release. */
export const Inspections: React.FC = () => {
  const [inspections, setInspections] = useState<Inspection[]>(SEED);
  const [kind, setKind] = useState<Kind | 'All'>('All');

  const rows = kind === 'All' ? inspections : inspections.filter((entry) => entry.kind === kind);
  const decided = inspections.filter((entry) => entry.result !== 'Pending');
  const accepted = decided.filter((entry) => entry.result === 'Accepted').length;

  const decide = (id: string, result: Exclude<Result, 'Pending'>) => {
    setInspections((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, result } : entry)),
    );
    toast.success(`${id} ${result.toLowerCase()}`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Inspections" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi">
          <div className="kpi-label">To inspect</div>
          <div className="kpi-value">{inspections.length - decided.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Accepted</div>
          <div className="kpi-value">{accepted}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Rejected</div>
          <div className={`kpi-value ${decided.length - accepted > 0 ? 'text-strand-red' : ''}`}>
            {decided.length - accepted}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Acceptance rate</div>
          <div className="kpi-value">
            {decided.length ? Math.round((accepted / decided.length) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="inline-flex flex-wrap items-center gap-0.5 p-0.5 rounded-lg bg-[#EBEBEF]">
          {KINDS.map((entry) => (
            <button
              key={entry}
              onClick={() => setKind(entry)}
              className={`h-7 px-3 rounded-md text-[13px] font-medium transition-colors ${
                kind === entry ? 'bg-white text-ink' : 'text-muted hover:text-ink'
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
                <th className="px-4 py-3 font-medium">Inspection</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Checks</th>
                <th className="px-4 py-3 font-medium text-right">Sample</th>
                <th className="px-4 py-3 font-medium text-right">Defects</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {rows.map((entry) => (
                <tr key={entry.id} className="h-[52px] hover:bg-canvas">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-code text-[13px] text-ink">{entry.id}</div>
                    <div className="font-code text-[13px] text-muted">{entry.reference}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{entry.kind}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{entry.item}</div>
                    <div className="text-[13px] text-muted">{entry.source}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[240px]">{entry.checks}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{entry.sampleSize}</td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      entry.defects > 0 ? 'text-strand-red' : ''
                    }`}
                  >
                    {entry.defects}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusPill status={entry.result} />
                  </td>
                  <td className="px-4 py-3">
                    {entry.result === 'Pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => decide(entry.id, 'Accepted')} className="btn-secondary">
                          <Check className="w-4 h-4 text-slate-500" />
                          Accept
                        </button>
                        <button
                          onClick={() => decide(entry.id, 'Rejected')}
                          className="btn-secondary text-strand-red"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
