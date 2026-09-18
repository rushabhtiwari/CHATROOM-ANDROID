import React, { useState } from 'react';
import { mockAuditLogs } from '../../data/admin';
import { AuditLogRecord } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { PageHeader } from '../../components/shell/PageHeader';
import { StatusPill } from '../../components/common/StatusPill';
import { ShieldCheck, Bot, User, Filter } from 'lucide-react';

export const AuditLog: React.FC = () => {
  const [filterType, setFilterType] = useState<'all' | 'agent' | 'human'>('all');

  const filteredLogs = mockAuditLogs.filter((log) => {
    if (filterType === 'agent' && log.actorType !== 'agent') return false;
    if (filterType === 'human' && log.actorType !== 'person') return false;
    return true;
  });

  const columns: ColumnDef<AuditLogRecord>[] = [
    {
      id: 'timestamp',
      header: 'Timestamp (IST)',
      accessorKey: 'timestamp',
      isMono: true,
      width: '150px',
      cell: (row) => <span className="text-muted text-xs">{row.timestamp}</span>
    },
    {
      id: 'actor',
      header: 'Actor & Type',
      accessorKey: 'actorName',
      width: '200px',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.actorType === 'agent' ? (
            <div className="w-6 h-6 rounded bg-ai-tint text-ai flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded bg-canvas text-slate-700 flex items-center justify-center shrink-0 border border-line">
              <User className="w-3.5 h-3.5" />
            </div>
          )}
          <div>
            <div className="font-semibold text-ink text-xs">{row.actorName}</div>
            <div className="text-[10px] text-muted font-mono">{row.recordType}</div>
          </div>
        </div>
      )
    },
    {
      id: 'action',
      header: 'Action Taken',
      accessorKey: 'action',
      width: '220px',
      cell: (row) => <span className="font-medium text-ink">{row.action}</span>
    },
    {
      id: 'recordId',
      header: 'Target Record ID',
      accessorKey: 'recordId',
      isMono: true,
      width: '160px',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-kiran bg-canvas px-1.5 py-0.5 rounded border border-line">
          {row.recordId}
        </span>
      )
    },
    {
      id: 'beforeValue',
      header: 'Before & After Delta',
      width: '260px',
      cell: (row) => (
        <div className="font-mono text-[11px]">
          {row.beforeValue && row.afterValue ? (
            <div className="space-y-0.5">
              <span className="text-muted line-through mr-1">{row.beforeValue}</span>
              <span className="text-strand-green font-bold">&rarr; {row.afterValue}</span>
            </div>
          ) : (
            <span className="text-slate-600">{row.afterValue || 'Event logged'}</span>
          )}
        </div>
      )
    },
    {
      id: 'ipAddress',
      header: 'IP / Channel',
      accessorKey: 'ipAddress',
      isMono: true,
      width: '140px',
      cell: (row) => <span className="text-muted text-xs">{row.ipAddress}</span>
    },
    {
      id: 'recordType',
      header: 'Record Type',
      accessorKey: 'recordType',
      width: '120px',
      cell: (row) => <span className="font-mono text-xs text-slate-700">{row.recordType}</span>
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader
        title="Immutable System Audit Trail"
      />

      <DataGrid
        data={filteredLogs}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search actor, action, target record ID..."
        savedViews={[
          { label: 'All Events', count: mockAuditLogs.length, active: filterType === 'all', onClick: () => setFilterType('all') },
          { label: 'Agent Actions Only', count: mockAuditLogs.filter(l => l.actorType === 'agent').length, active: filterType === 'agent', onClick: () => setFilterType('agent') },
          { label: 'Human Overrides', count: mockAuditLogs.filter(l => l.actorType === 'person').length, active: filterType === 'human', onClick: () => setFilterType('human') },
        ]}
      />
    </div>
  );
};
