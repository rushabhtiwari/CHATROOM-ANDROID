import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockAIRunLogs } from '../../data/aiControl';
import { AIRunLog } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { ConfidenceChip } from '../../components/common/ConfidenceChip';
import { PageHeader } from '../../components/shell/PageHeader';
import { IndianRupee } from '../../components/common/IndianRupee';
import { formatINR } from '../../utils/formatters';
import { Activity, ArrowRight, Sparkles, Filter } from 'lucide-react';

export const AIRuns: React.FC = () => {
  const navigate = useNavigate();

  const columns: ColumnDef<AIRunLog>[] = [
    {
      id: 'id',
      header: 'Run ID',
      accessorKey: 'id',
      isMono: true,
      width: '140px',
      cell: (row) => (
        <Link to={`/ai/runs/${row.id}`} className="text-ai hover:underline font-mono font-semibold">
          {row.id}
        </Link>
      )
    },
    {
      id: 'feature',
      header: 'Autonomous Agent Feature',
      accessorKey: 'feature',
      width: '220px',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.feature}</div>
          <div className="text-[12px] text-muted font-mono">{row.timestamp}</div>
        </div>
      )
    },
    {
      id: 'model',
      header: 'Model Engine',
      accessorKey: 'model',
      isMono: true,
      width: '160px',
      cell: (row) => <span className="font-mono text-xs text-ai font-semibold">{row.model}</span>
    },
    {
      id: 'durationSec',
      header: 'Latency',
      accessorKey: 'durationSec',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => `${row.durationSec}s`
    },
    {
      id: 'tokensUsed',
      header: 'Tokens',
      accessorKey: 'tokensUsed',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => row.tokensUsed.toLocaleString('en-IN')
    },
    {
      id: 'costINR',
      header: 'Cost (INR)',
      accessorKey: 'costINR',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => `₹${row.costINR.toFixed(2)}`
    },
    {
      id: 'confidencePct',
      header: 'Confidence',
      accessorKey: 'confidencePct',
      width: '120px',
      cell: (row) => <ConfidenceChip confidence={row.confidencePct} />
    },
    {
      id: 'runId',
      header: 'Linked Record',
      accessorKey: 'runId',
      isMono: true,
      width: '150px',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700 font-semibold bg-canvas px-1.5 py-0.5 rounded border border-line">
          {row.runId}
        </span>
      )
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      width: '120px',
      cell: (row) => <StatusPill status={row.status} />
    }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      <PageHeader
        title="Agent Execution Logs & Observability"
      />

      <DataGrid
        data={mockAIRunLogs}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => navigate(`/ai/runs/${item.id}`)}
        searchPlaceholder="Search run ID, feature name, linked record..."
      />
    </div>
  );
};
