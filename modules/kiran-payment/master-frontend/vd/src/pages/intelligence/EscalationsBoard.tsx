import React from 'react';
import { mockEscalations } from '../../data/comms';
import { EscalationRecord } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';

const SEVERITY_PILL: Record<EscalationRecord['severity'], string> = {
  Critical: 'bg-[#FBE9E7] text-[#B3302A]',
  High: 'bg-[#FBEFDC] text-[#8A4F00]',
  Medium: 'bg-[#EFEFF2] text-[#48484F]',
};

export const EscalationsBoard: React.FC = () => {
  const severities: EscalationRecord['severity'][] = ['Critical', 'High', 'Medium'];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Escalations" />

      {/* 3 column severity grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {severities.map((sev) => {
          const items = mockEscalations.filter(e => e.severity === sev);

          return (
            <div key={sev} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold text-ink">{sev}</h3>
                <span className={`px-2 py-0.5 rounded-md text-[13px] font-medium tabular-nums ${SEVERITY_PILL[sev]}`}>
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="bg-surface border border-line rounded-lg py-12 text-center text-muted text-[14px]">
                  Nothing here.
                </div>
              ) : (
                items.map((esc) => (
                  <div
                    key={esc.id}
                    className="p-5 bg-surface border border-line rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-code text-[13px] text-muted whitespace-nowrap">
                        {esc.recordId}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#EFEFF2] text-[#48484F] text-[12px] font-medium whitespace-nowrap">
                        {esc.currentLevel}
                      </span>
                    </div>

                    <h4 className="font-medium text-[14px] text-ink leading-snug">
                      {esc.recordTitle}
                    </h4>

                    <dl className="space-y-1.5 text-[13px]">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Type</dt>
                        <dd className="text-ink">{esc.recordType}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">With</dt>
                        <dd className="text-ink text-right">{esc.currentRole}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Waiting</dt>
                        <dd className="text-strand-red font-medium whitespace-nowrap">{esc.timeAtLevel}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Next step</dt>
                        <dd className="text-ink text-right">{esc.nextAutoEscalateAt}</dd>
                      </div>
                    </dl>

                    {/* Escalation trail */}
                    <div className="space-y-1 text-[13px] text-muted pt-3 border-t border-line-2">
                      {esc.history.map((h, i) => (
                        <div key={i}>
                          {h.level} ({h.role}) · {h.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
