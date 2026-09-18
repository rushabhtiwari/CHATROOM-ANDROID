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
      <PageHeader
        title="Inspections"
        description="Incoming material, in-process checks and final release, with the sample size, the defects found and the decision."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Awaiting inspection', value: inspections.length - decided.length, tone: 'text-ai' },
          { label: 'Accepted', value: accepted, tone: 'text-strand-green' },
          { label: 'Rejected', value: decided.length - accepted, tone: 'text-strand-red' },
          { label: 'Acceptance rate', value: `${decided.length ? Math.round((accepted / decided.length) * 100) : 0}%`, tone: 'text-ink' },
        ].map((card) => (
          <div key={card.label} className="p-4 bg-surface border border-line rounded-md shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{card.label}</div>
            <div className={`text-2xl font-display font-bold mt-1 ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {KINDS.map((entry) => (
            <button
              key={entry}
              onClick={() => setKind(entry)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                kind === entry
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
                <th className="p-3 font-semibold">Inspection</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Item</th>
                <th className="p-3 font-semibold">Checks</th>
                <th className="p-3 font-semibold text-right">Sample</th>
                <th className="p-3 font-semibold text-right">Defects</th>
                <th className="p-3 font-semibold">Result</th>
                <th className="p-3 font-semibold text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="p-3">
                    <div className="font-mono font-semibold text-kiran">{entry.id}</div>
                    <div className="text-[11px] font-mono text-muted">{entry.reference}</div>
                  </td>
                  <td className="p-3">{entry.kind}</td>
                  <td className="p-3">
                    <div className="font-semibold text-ink">{entry.item}</div>
                    <div className="text-[11px] text-muted">{entry.source}</div>
                  </td>
                  <td className="p-3 text-slate-600 max-w-[240px]">{entry.checks}</td>
                  <td className="p-3 text-right font-mono">{entry.sampleSize}</td>
                  <td
                    className={`p-3 text-right font-mono ${
                      entry.defects > 0 ? 'text-strand-red font-semibold' : 'text-slate-700'
                    }`}
                  >
                    {entry.defects}
                  </td>
                  <td className="p-3">
                    <StatusPill status={entry.result} />
                  </td>
                  <td className="p-3">
                    {entry.result === 'Pending' && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => decide(entry.id, 'Accepted')}
                          className="px-2 py-1 rounded bg-strand-green text-white text-[11px] font-semibold hover:opacity-90 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Accept
                        </button>
                        <button
                          onClick={() => decide(entry.id, 'Rejected')}
                          className="px-2 py-1 rounded border border-line text-slate-700 text-[11px] font-semibold hover:border-strand-red hover:text-strand-red flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
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
