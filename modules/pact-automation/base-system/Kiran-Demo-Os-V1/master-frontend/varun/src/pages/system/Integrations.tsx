import React, { useState } from 'react';
import {
  mockIntegrations,
  mockPactFieldMappings,
  mockSapChecklist
} from '../../data/integrations';
import { IntegrationRecord } from '../../types';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Mail,
  MessageSquare,
  Sparkles,
  Play
} from 'lucide-react';

export const Integrations: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>(mockIntegrations);
  const [isMigrating, setIsMigrating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSyncNow = (name: string) => {
    setToastMessage(`Initiated live handshake with ${name}. Cache synchronized.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRunMigrationTest = () => {
    setIsMigrating(true);
    setTimeout(() => {
      setIsMigrating(false);
      setToastMessage('SAP S/4HANA Migration test batch passed: 14,200 records staged.');
      setTimeout(() => setToastMessage(null), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Enterprise Connectors & ERP Migration Hub"
      />

      {/* SAP S/4HANA Migration Hub Card */}
      <div className="bg-surface border-2 border-ai rounded-md p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-ai text-white flex items-center justify-center font-bold font-mono text-sm">
              SAP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-lg text-ink">
                  SAP S/4HANA Enterprise Migration Readiness
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-ai-tint text-ai font-bold">
                  Phase 3: Staging
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Legacy PACT ERP to SAP S/4HANA Cloud transition planned for Q4 2026.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right font-mono">
              <div className="text-[10px] text-muted uppercase font-sans">Readiness Score</div>
              <div className="text-xl font-bold text-strand-green">78% Certified</div>
            </div>
            <button
              onClick={handleRunMigrationTest}
              disabled={isMigrating}
              className="px-4 py-2 bg-ai hover:bg-ai/90 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Play className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
              <span>{isMigrating ? 'Staging Batches...' : 'Run Migration Sandbox'}</span>
            </button>
          </div>
        </div>

        {/* SAP Checklist Progress Items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
          {mockSapChecklist.map((item, idx) => (
            <div key={idx} className="p-3 bg-canvas rounded border border-line space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-sans font-semibold text-ink truncate">{item.module}</span>
                {item.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-strand-green" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-strand-amber" />
                )}
              </div>
              <div className="text-[11px] text-muted font-sans">{item.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integ) => (
          <div
            key={integ.id}
            className="bg-surface border border-line hover:border-kiran rounded-md p-5 shadow-card space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-display font-semibold text-sm text-ink">
                  {integ.name}
                </h4>
                <StatusPill status={integ.status} />
              </div>
              <p className="text-xs text-muted leading-relaxed">
                {integ.description}
              </p>

              <div className="p-2.5 bg-canvas rounded border border-line space-y-1 font-mono text-[11px] mt-2">
                <div className="flex justify-between text-muted">
                  <span>Sync Frequency:</span>
                  <span className="text-ink font-semibold">{integ.status === 'Connected' ? 'Real-time' : 'On demand'}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Last Sync:</span>
                  <span className="text-slate-700">{integ.lastSyncTime}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-mono">
              <span className="text-[11px] text-muted font-sans font-medium">
                {(integ.recordsIn + integ.recordsOut).toLocaleString('en-IN')} Records Synced
              </span>
              <button
                onClick={() => handleSyncNow(integ.name)}
                className="px-2.5 py-1 bg-white hover:bg-canvas border border-line text-xs font-semibold text-kiran rounded flex items-center gap-1 shadow-2xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sync Now</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* PACT ERP Field Mapping Schema Viewer */}
      <div className="bg-surface border border-line rounded-lg p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="font-display font-semibold text-sm text-ink">
              PACT ERP Database Field Mapping Specification
            </h3>
            <p className="text-xs text-muted">Bi-directional translation table between KiranOS JSON domain models and PACT SQL database</p>
          </div>
          <span className="font-mono text-xs text-muted">Schema v4.2</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-canvas text-muted text-[10px] uppercase border-b border-line">
              <tr>
                <th className="p-2.5">KiranOS Domain Attribute</th>
                <th className="p-2.5">PACT SQL Column / Table</th>
                <th className="p-2.5">Data Type</th>
                <th className="p-2.5">Sync Direction</th>
                <th className="p-2.5 font-sans">Business Transformation Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {mockPactFieldMappings.map((f, i) => (
                <tr key={i} className="hover:bg-canvas/50">
                  <td className="p-2.5 font-bold text-kiran">{f.kiranField}</td>
                  <td className="p-2.5 text-ink">{f.remoteField}</td>
                  <td className="p-2.5 text-muted">String</td>
                  <td className="p-2.5 text-slate-700">{f.direction}</td>
                  <td className="p-2.5 font-sans text-slate-700">{f.lastError || 'Direct field mapping'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
