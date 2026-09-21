import React from 'react';
import { mockEscalations } from '../../data/comms';
import { EscalationRecord } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

export const EscalationsBoard: React.FC = () => {
  const severities: EscalationRecord['severity'][] = ['Critical', 'High', 'Medium'];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Live Escalation Matrix & Governance Board"
      />

      {/* 3 Column Severity Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {severities.map((sev) => {
          const items = mockEscalations.filter(e => e.severity === sev);

          return (
            <div
              key={sev}
              className="bg-surface border border-line rounded-lg shadow-card flex flex-col justify-between"
            >
              {/* Header */}
              <div className={`p-4 border-b border-line flex items-center justify-between rounded-t-md ${
                sev === 'Critical'
                  ? 'bg-red-50/60 text-strand-red'
                  : sev === 'High'
                  ? 'bg-amber-50/60 text-strand-amber'
                  : 'bg-canvas text-slate-700'
              }`}>
                <div className="flex items-center gap-2 font-display font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{sev} Severity</span>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-line font-bold">
                  {items.length} Active
                </span>
              </div>

              {/* Cards List */}
              <div className="p-4 space-y-4 flex-1">
                {items.length === 0 ? (
                  <div className="py-12 text-center text-muted text-xs">
                    No active {sev.toLowerCase()} escalations.
                  </div>
                ) : (
                  items.map((esc) => (
                    <div
                      key={esc.id}
                      className="p-4 bg-white border border-line rounded-md shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-ink">
                          {esc.recordId} ({esc.recordType})
                        </span>
                        <span className="font-mono text-[12px] px-1.5 py-0.2 rounded bg-ink text-white font-semibold">
                          {esc.currentLevel}
                        </span>
                      </div>

                      <h4 className="font-semibold text-xs text-ink leading-snug">
                        {esc.recordTitle}
                      </h4>

                      <div className="p-2 bg-canvas rounded border border-line space-y-1 font-mono text-[12px]">
                        <div className="flex justify-between text-muted">
                          <span>Current Role:</span>
                          <strong className="text-ink font-sans">{esc.currentRole}</strong>
                        </div>
                        <div className="flex justify-between text-muted">
                          <span>Time at Level:</span>
                          <strong className="text-strand-red">{esc.timeAtLevel}</strong>
                        </div>
                        <div className="pt-1 border-t border-line/60 text-[12px] text-strand-amber font-sans">
                          Next climb: {esc.nextAutoEscalateAt}
                        </div>
                      </div>

                      {/* Escalation Trail */}
                      <div className="space-y-1 text-[12px] text-muted font-mono pt-1">
                        <div className="font-sans font-semibold text-[12px]">
                          Escalation History
                        </div>
                        {esc.history.map((h, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>{h.level} ({h.role})</span>
                            <span>·</span>
                            <span>{h.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
