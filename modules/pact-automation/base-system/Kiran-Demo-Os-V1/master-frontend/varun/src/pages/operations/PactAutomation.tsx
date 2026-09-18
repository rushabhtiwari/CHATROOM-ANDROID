import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '../../components/shell/PageHeader';
import { KPICard, LedgerBand } from '../../components/common/KPICard';
import { StatusPill } from '../../components/common/StatusPill';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { pactApi, PactStatus, PactEntry } from '../../modules/pact/api';
import {
  Bot,
  Activity,
  Server,
  Sliders,
  ShieldCheck,
  RefreshCw,
  Plus,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Copy,
  Eye,
  Check,
  X,
  WifiOff,
  Clock,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'pending' | 'saved' | 'failed' | 'rejected';

export const PactAutomation: React.FC = () => {
  const [status, setStatus] = useState<PactStatus | null>(null);
  const [entries, setEntries] = useState<PactEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reachable, setReachable] = useState<boolean>(false);

  // Filter tab
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  // Selected entry for drawer / modal
  const [selectedEntry, setSelectedEntry] = useState<PactEntry | null>(null);
  const [entryLog, setEntryLog] = useState<string | null>(null);
  const [loadingLog, setLoadingLog] = useState<boolean>(false);

  // Confirmation modals
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject';
    entry: PactEntry;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Quick Add modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCustomer, setNewCustomer] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, entriesRes] = await Promise.all([
        pactApi.status().catch((err) => {
          console.warn('PACT status error:', err);
          return null;
        }),
        pactApi.entries().catch((err) => {
          console.warn('PACT entries error:', err);
          return [];
        }),
      ]);

      if (statusRes) {
        setStatus(statusRes);
        setReachable(true);
      } else {
        setStatus(null);
        setReachable(false);
      }

      setEntries(entriesRes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to communicate with PACT Automation');
      setReachable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Fetch full log when selecting an entry
  useEffect(() => {
    if (!selectedEntry) {
      setEntryLog(null);
      return;
    }
    // If entry already has log string, use it
    if (typeof selectedEntry.log === 'string' && selectedEntry.log.trim()) {
      setEntryLog(selectedEntry.log);
      return;
    }
    // Otherwise fetch fresh from log endpoint
    setLoadingLog(true);
    pactApi
      .log(selectedEntry.id)
      .then((res) => {
        setEntryLog(res.log || 'No log recorded for this entry.');
      })
      .catch(() => {
        setEntryLog(selectedEntry.log || 'Log could not be retrieved.');
      })
      .finally(() => {
        setLoadingLog(false);
      });
  }, [selectedEntry]);

  // Approve action
  const handleApprove = async (entry: PactEntry) => {
    setActionLoading(true);
    try {
      const updated = await pactApi.approve(entry.id);
      toast.success(`PACT Entry #${entry.id} approved!`);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...updated } : e)));
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry((prev) => (prev ? { ...prev, ...updated } : null));
      }
      setConfirmAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve entry');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject action
  const handleReject = async (entry: PactEntry) => {
    setActionLoading(true);
    try {
      const updated = await pactApi.reject(entry.id);
      toast.info(`PACT Entry #${entry.id} rejected.`);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...updated } : e)));
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry((prev) => (prev ? { ...prev, ...updated } : null));
      }
      setConfirmAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject entry');
    } finally {
      setActionLoading(false);
    }
  };

  // Add customer manually
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.trim()) {
      toast.error('Customer name is required.');
      return;
    }
    setAddLoading(true);
    try {
      const record: Record<string, unknown> = {
        Customer: newCustomer.trim(),
        City: newCity.trim() || 'N/A',
        Phone: newPhone.trim() || 'N/A',
      };
      const created = await pactApi.add(record, 'kiranos-dashboard');
      toast.success(`Queued PACT entry #${created.id} for approval!`);
      setShowAddModal(false);
      setNewCustomer('');
      setNewCity('');
      setNewPhone('');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue record');
    } finally {
      setAddLoading(false);
    }
  };

  // Filtered data for grid
  const filteredEntries = useMemo(() => {
    if (activeFilter === 'all') return entries;
    return entries.filter((e) => e.status?.toLowerCase() === activeFilter);
  }, [entries, activeFilter]);

  // Counts for tabs
  const counts = useMemo(() => {
    const res: Record<string, number> = {
      all: Array.isArray(entries) ? entries.length : 0,
      pending: 0,
      saved: 0,
      failed: 0,
      rejected: 0,
    };
    (Array.isArray(entries) ? entries : []).forEach((e) => {
      const st = e.status?.toLowerCase();
      if (st && Object.prototype.hasOwnProperty.call(res, st)) res[st] += 1;
    });
    return res;
  }, [entries]);

  // Columns for DataGrid
  const columns: ColumnDef<PactEntry>[] = [
    {
      id: 'id',
      header: 'Entry ID',
      accessorKey: 'id',
      sortable: true,
      isMono: true,
      width: '100px',
      cell: (row) => (
        <span className="font-mono font-bold text-primary flex items-center gap-1">
          #{row.id}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: '130px',
      cell: (row) => <StatusPill status={row.status} />,
    },
    {
      id: 'recordSummary',
      header: 'Customer / Record Details',
      width: '320px',
      cell: (row) => {
        const cust =
          row.record?.Customer ||
          row.record?.customer ||
          row.record?.name ||
          row.record?.company ||
          'Unnamed Record';
        const city = String(row.record?.City || row.record?.city || '');
        const phone = String(row.record?.Phone || row.record?.phone || '');

        return (
          <div className="py-1">
            <div className="font-medium text-ink text-[13px]">{String(cust)}</div>
            {city || phone ? (
              <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5 font-mono">
                {city ? <span>📍 {city}</span> : null}
                {phone ? <span>📞 {phone}</span> : null}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'source',
      header: 'Source',
      width: '140px',
      cell: (row) => (
        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-surface-container-highest/80 text-on-surface-variant border border-outline-variant">
          {row.source || 'kiranos'}
        </span>
      ),
    },
    {
      id: 'result',
      header: 'Verification / Result',
      width: '200px',
      cell: (row) => {
        if (row.result?.verifier) {
          const ok = row.result.verifier.ok;
          const mismatches = row.result.verifier.mismatches?.length || 0;
          return ok ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Verified OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              <AlertTriangle className="w-3 h-3 text-red-600" />
              {mismatches} Mismatch{mismatches !== 1 ? 'es' : ''}
            </span>
          );
        }
        if (row.error) {
          return (
            <span className="text-[11px] text-red-600 truncate max-w-[180px] inline-block font-mono" title={row.error}>
              ⚠️ {row.error}
            </span>
          );
        }
        if (row.status === 'pending') {
          return <span className="text-[11px] text-amber-600 font-mono">Awaiting operator</span>;
        }
        return <span className="text-[11px] text-muted">—</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      width: '180px',
      cell: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {row.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => setConfirmAction({ type: 'approve', entry: row })}
                  className="px-2.5 py-1 text-[11px] font-semibold border-2 border-ink bg-accent active:translate-y-px hover:brightness-95 text-accent-ink rounded-md shadow-xs transition-colors flex items-center gap-1"
                title="Approve entry for worker execution"
              >
                <Check className="w-3 h-3" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction({ type: 'reject', entry: row })}
                className="px-2.5 py-1 text-[11px] font-semibold bg-surface-container-highest hover:bg-red-50 text-red-600 border border-outline-variant hover:border-red-200 rounded-md transition-colors flex items-center gap-1"
                title="Reject entry"
              >
                <X className="w-3 h-3" />
                Reject
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSelectedEntry(row)}
            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-md transition-colors"
            title="View Details & Log"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <PageHeader
        category="Operations"
        title="PACT Automation"
        description="Controlled operational bridge between KiranOS and the local PACT Automation worker for automated ERP record entry, verification, and audit logging."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void fetchData()}
              disabled={loading}
              className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 bg-primary hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Queue Record</span>
            </button>
          </div>
        }
      />

      {/* Unreachable service warning banner */}
      {!reachable && !loading && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">PACT Automation Service Offline</h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Could not reach the local PACT Automation worker on <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">http://127.0.0.1:8765</code>. Ensure the service is running in a second terminal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-[11px] font-mono bg-amber-100 text-amber-900 px-2.5 py-1 rounded border border-amber-200 select-all">
              .\scripts\start.ps1
            </div>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold font-mono transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <LedgerBand cols={5}>
        <KPICard
          title="PACT Worker"
          value={reachable ? (status?.busy ? 'Busy' : 'Idle') : 'Offline'}
          status={reachable ? (status?.busy ? 'neutral' : 'positive') : 'critical'}
          icon={Bot}
          subtitle={
            reachable
              ? status?.busy
                ? `Active on entry #${status?.current}`
                : 'Worker listening & healthy'
              : 'Service offline'
          }
        />

        <KPICard
          title="Service Reachability"
          value={reachable ? 'Connected' : 'Unreachable'}
          status={reachable ? 'positive' : 'critical'}
          icon={Server}
          subtitle="Endpoint: :8765"
        />

        <KPICard
          title="Active Profile"
          value={status?.settings?.profile || status?.settings?.active_profile || 'Default'}
          status="neutral"
          icon={Sliders}
          subtitle={`${entries.length} total entries tracked`}
        />

        <KPICard
          title="Dry-Run Mode"
          value={status?.settings?.dry_run ? 'Dry-Run Active' : 'Live Mode'}
          status={status?.settings?.dry_run ? 'neutral' : 'positive'}
          icon={ShieldCheck}
          subtitle={status?.settings?.dry_run ? 'Simulating ERP actions' : 'Real ERP updates enabled'}
        />

        <KPICard
          title="Auto-Save Mode"
          value={status?.settings?.auto_save ? 'Auto-Save On' : 'Manual Save'}
          status={status?.settings?.auto_save ? 'positive' : 'neutral'}
          icon={Activity}
          subtitle={status?.settings?.auto_save ? 'Automatic form submission' : 'Operator review required'}
        />
      </LedgerBand>

      {/* Main Content Area */}
      <div className="bg-surface rounded-xl border border-outline-variant shadow-xs overflow-hidden">
        {/* Saved Views / Filter Tabs */}
        <div className="border-b border-outline-variant px-4 py-2.5 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All Entries' },
              { id: 'pending', label: 'Pending Approval' },
              { id: 'saved', label: 'Saved / Done' },
              { id: 'failed', label: 'Failed' },
              { id: 'rejected', label: 'Rejected' },
            ].map((tab) => {
              const count = counts[tab.id] || 0;
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id as StatusFilter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono flex items-center gap-2 transition-all ${
                    active
                      ? 'bg-primary text-white font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-container-highest text-on-surface-variant'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-muted shrink-0">
            Showing {filteredEntries.length} of {entries.length} entries
          </div>
        </div>

        {/* DataGrid */}
        <div className="p-4">
          <DataGrid
            data={filteredEntries}
            columns={columns}
            keyExtractor={(item) => String(item.id)}
            onRowClick={(item) => setSelectedEntry(item)}
            initialSortKey="id"
            initialSortDir="desc"
            searchPlaceholder="Search customer, city, phone, status..."
            searchKey={(item) =>
              `${item.id} ${JSON.stringify(item.record || {})} ${item.status || ''} ${item.source || ''}`
            }
          />
        </div>
      </div>

      {/* Slide-Over Drawer for Entry Details & Full Log */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedEntry(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-xl bg-surface border-l border-outline-variant shadow-2xl h-full flex flex-col z-10 animate-slideLeft">
            {/* Drawer Header */}
            <div className="p-5 border-b border-outline-variant flex items-center justify-between gap-4 bg-surface-container-lowest">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-display font-semibold text-lg text-on-surface">
                    PACT Entry #{selectedEntry.id}
                  </h3>
                  <StatusPill status={selectedEntry.status} />
                </div>
                <div className="text-xs text-on-surface-variant mt-0.5 font-mono">
                  Source: <span className="text-ink font-semibold">{selectedEntry.source || 'kiranos'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="p-2 text-on-surface-variant hover:text-ink hover:bg-surface-container-highest rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Record Fields */}
              <div>
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-outline mb-2">
                  Customer Record Payload
                </h4>
                <div className="bg-surface-container-low rounded-lg p-3.5 border border-outline-variant space-y-2">
                  {Object.entries(selectedEntry.record || {}).map(([key, val]) => (
                    <div key={key} className="flex items-start justify-between gap-4 text-xs">
                      <span className="font-mono text-on-surface-variant font-medium">{key}:</span>
                      <span className="font-semibold text-ink text-right break-all">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification & Error Details */}
              {(selectedEntry.result?.verifier || selectedEntry.error) && (
                <div>
                  <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-outline mb-2">
                    Verification & Diagnostics
                  </h4>
                  <div className="bg-surface-container-low rounded-lg p-3.5 border border-outline-variant space-y-3">
                    {selectedEntry.error && (
                      <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-900 text-xs font-mono">
                        <strong>Error:</strong> {selectedEntry.error}
                      </div>
                    )}

                    {selectedEntry.result?.verifier && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-medium text-on-surface">Verifier Status:</span>
                          <span
                            className={`font-semibold ${
                              selectedEntry.result.verifier.ok ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {selectedEntry.result.verifier.ok ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>

                        {selectedEntry.result.verifier.mismatches &&
                          selectedEntry.result.verifier.mismatches.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <span className="text-[11px] font-mono text-outline">
                                Field Mismatches:
                              </span>
                              {selectedEntry.result.verifier.mismatches.map((m, idx) => (
                                <div
                                  key={idx}
                                  className="text-[11px] font-mono p-2 rounded bg-red-50/70 border border-red-100 text-red-800"
                                >
                                  <strong>{m.field}:</strong> expected{' '}
                                  <code className="bg-white px-1 rounded">{String(m.expected)}</code>, saw{' '}
                                  <code className="bg-white px-1 rounded">{String(m.seen)}</code>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    )}

                    {selectedEntry.result?.confirmation && (
                      <div className="text-xs text-on-surface-variant pt-2 border-t border-outline-variant">
                        <span className="font-medium">ERP Confirmation: </span>
                        {selectedEntry.result.confirmation.record_id && (
                          <span className="font-mono font-semibold text-emerald-700">
                            #{selectedEntry.result.confirmation.record_id}
                          </span>
                        )}
                        {selectedEntry.result.confirmation.text && (
                          <p className="mt-1 font-mono text-[11px] text-muted">
                            {selectedEntry.result.confirmation.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Execution Log */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-outline flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-primary" />
                    <span>Execution Log</span>
                  </h4>
                  {entryLog && (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(entryLog);
                        toast.success('Log copied to clipboard');
                      }}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
                    >
                      <Copy className="w-3 h-3" />
                      Copy Log
                    </button>
                  )}
                </div>

                <div className="bg-slate-950 text-emerald-400 p-3.5 rounded-lg border border-slate-800 font-mono text-xs overflow-auto max-h-72 leading-relaxed whitespace-pre-wrap select-text">
                  {loadingLog ? (
                    <div className="flex items-center gap-2 text-slate-400">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading entry logs...</span>
                    </div>
                  ) : entryLog ? (
                    entryLog
                  ) : (
                    <span className="text-slate-500 italic">No execution logs recorded.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between gap-3">
              {selectedEntry.status === 'pending' ? (
                <div className="flex items-center gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'approve', entry: selectedEntry })}
                      className="flex-1 py-2 border-2 border-ink bg-accent active:translate-y-px hover:brightness-95 text-accent-ink rounded-lg text-xs font-semibold font-mono transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve for PACT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'reject', entry: selectedEntry })}
                    className="flex-1 py-2 bg-surface-container-highest hover:bg-red-50 text-red-600 border border-outline-variant rounded-lg text-xs font-semibold font-mono transition-colors flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-muted font-mono w-full text-center">
                  Entry is in terminal state <strong className="uppercase">{selectedEntry.status}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Approve / Reject */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => !actionLoading && setConfirmAction(null)}
          />

          <div className="relative bg-surface rounded-xl border border-outline-variant shadow-xl max-w-md w-full p-6 z-10 space-y-4 animate-scaleUp">
            <div className="flex items-start gap-3">
              {confirmAction.type === 'approve' ? (
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                  <Check className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2.5 bg-red-100 text-red-700 rounded-full shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="text-base font-semibold text-ink">
                  {confirmAction.type === 'approve' ? 'Approve' : 'Reject'} PACT Entry #{confirmAction.entry.id}?
                </h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  {confirmAction.type === 'approve'
                    ? `This will queue entry #${confirmAction.entry.id} (${confirmAction.entry.record?.Customer || 'record'}) for execution and ERP data-entry by the PACT Automation worker.`
                    : `This will mark entry #${confirmAction.entry.id} as rejected. The worker will not process this entry.`}
                </p>
              </div>
            </div>

            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant text-xs space-y-1 font-mono">
              <div>
                <strong>Customer:</strong> {String(confirmAction.entry.record?.Customer || 'N/A')}
              </div>
              {Boolean(confirmAction.entry.record?.City) && (
                <div>
                  <strong>City:</strong> {String(confirmAction.entry.record.City)}
                </div>
              )}
              {Boolean(confirmAction.entry.record?.Phone) && (
                <div>
                  <strong>Phone:</strong> {String(confirmAction.entry.record.Phone)}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  confirmAction.type === 'approve'
                    ? handleApprove(confirmAction.entry)
                    : handleReject(confirmAction.entry)
                }
                className={`px-4 py-2 text-xs font-semibold rounded-lg font-mono text-white transition-colors flex items-center gap-1.5 shadow-xs ${
                  confirmAction.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  Confirm {confirmAction.type === 'approve' ? 'Approval' : 'Rejection'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => !addLoading && setShowAddModal(false)}
          />

          <div className="relative bg-surface rounded-xl border border-outline-variant shadow-xl max-w-md w-full p-6 z-10 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-ink">Queue Customer in PACT</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Customer / Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Industries Pvt Ltd"
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-outline-variant focus:border-primary focus:outline-hidden bg-surface"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">City</label>
                <input
                  type="text"
                  placeholder="e.g. Pune"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-outline-variant focus:border-primary focus:outline-hidden bg-surface"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9820000000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-outline-variant focus:border-primary focus:outline-hidden bg-surface"
                />
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                Records created here are placed in the <strong className="text-amber-700">pending</strong> queue and require operator approval before the PACT Automation worker inputs them.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  disabled={addLoading}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg font-mono bg-primary hover:bg-brand-600 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {addLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit to PACT</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PactAutomation;
