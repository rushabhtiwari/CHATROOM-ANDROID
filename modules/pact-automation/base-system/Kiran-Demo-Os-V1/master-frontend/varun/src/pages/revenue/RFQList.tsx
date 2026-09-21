import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  LayoutGrid,
  List,
  Mail,
  Plus,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';
import { mockRFQs } from '../../data/rfqs';
import { RFQItem } from '../../types';
import { DataGrid, ColumnDef } from '../../components/common/DataGrid';
import { StatusPill } from '../../components/common/StatusPill';
import { AgeIndicator } from '../../components/common/AgeIndicator';
import { IndianRupee } from '../../components/common/IndianRupee';
import { PageHeader } from '../../components/shell/PageHeader';
import { formatDate, formatINR } from '../../utils/formatters';

export const RFQList: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
  const [activeSavedView, setActiveSavedView] = useState<string>('All open');
  const [rfqList, setRfqList] = useState<RFQItem[]>(mockRFQs);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const savedViews = [
    { label: 'All open', count: 18, active: activeSavedView === 'All open', onClick: () => setActiveSavedView('All open') },
    { label: 'My tickets', count: 6, active: activeSavedView === 'My tickets', onClick: () => setActiveSavedView('My tickets') },
    { label: 'Overdue', count: 2, active: activeSavedView === 'Overdue', onClick: () => setActiveSavedView('Overdue') },
    { label: 'Awaiting approval', count: 3, active: activeSavedView === 'Awaiting approval', onClick: () => setActiveSavedView('Awaiting approval') },
    { label: 'Unassigned', count: 1, active: activeSavedView === 'Unassigned', onClick: () => setActiveSavedView('Unassigned') }
  ];

  const filteredRFQs = rfqList.filter((r) => {
    if (activeSavedView === 'My tickets' && r.ownerName !== 'Rajesh Kumar') return false;
    if (activeSavedView === 'Overdue' && r.status !== 'Overdue') return false;
    if (activeSavedView === 'Awaiting approval' && r.status !== 'Awaiting approval') return false;
    if (activeSavedView === 'Unassigned' && r.ownerName !== 'Unassigned') return false;
    return true;
  });

  const columns: ColumnDef<RFQItem>[] = [
    {
      id: 'rfqNumber',
      header: 'RFQ No.',
      accessorKey: 'rfqNumber',
      isMono: true,
      width: '130px',
      cell: (row) => (
        <Link
          to={`/rfq/${row.id}`}
          className="text-kiran hover:underline font-mono font-semibold"
        >
          {row.rfqNumber}
        </Link>
      )
    },
    {
      id: 'customerName',
      header: 'Customer',
      accessorKey: 'customerName',
      width: '200px',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.customerName}</div>
          <div className="text-[12px] text-muted font-mono">{row.region} Zone</div>
        </div>
      )
    },
    {
      id: 'partNumber',
      header: 'Part No.',
      accessorKey: 'partNumber',
      isMono: true,
      width: '130px',
      cell: (row) => <span className="font-mono text-xs text-slate-800">{row.partNumber}</span>
    },
    {
      id: 'description',
      header: 'Description',
      accessorKey: 'description',
      width: '240px',
      cell: (row) => <span className="text-xs text-slate-600 truncate max-w-[220px] block">{row.description}</span>
    },
    {
      id: 'quantity',
      header: 'Quantity',
      accessorKey: 'quantity',
      isNumeric: true,
      isMono: true,
      width: '110px',
      cell: (row) => `${row.quantity.toLocaleString('en-IN')} ${row.uom}`
    },
    {
      id: 'sopDate',
      header: 'SOP Date',
      accessorKey: 'sopDate',
      isMono: true,
      width: '110px',
      cell: (row) => formatDate(row.sopDate)
    },
    {
      id: 'ownerName',
      header: 'Owner',
      accessorKey: 'ownerName',
      width: '140px',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-ink text-white font-mono text-[12px] flex items-center justify-center">
            {row.ownerName.split(' ').map(n => n[0]).join('')}
          </div>
          <span className="text-xs text-slate-700">{row.ownerName}</span>
        </div>
      )
    },
    {
      id: 'stage',
      header: 'Stage',
      accessorKey: 'stage',
      width: '120px',
      cell: (row) => (
        <span className="font-medium text-xs text-slate-700 px-2 py-0.5 rounded bg-canvas border border-line">
          {row.stage}
        </span>
      )
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      width: '130px',
      cell: (row) => <StatusPill status={row.status} />
    },
    {
      id: 'daysInStage',
      header: 'Age / SLA',
      accessorKey: 'daysInStage',
      width: '100px',
      cell: (row) => <AgeIndicator daysInStage={row.daysInStage} slaLimitDays={row.slaLimitDays} />
    },
    {
      id: 'estimatedValue',
      header: 'Est. Value',
      accessorKey: 'estimatedValue',
      isNumeric: true,
      isMono: true,
      width: '120px',
      cell: (row) => <IndianRupee amount={row.estimatedValue} />
    },
    {
      id: 'source',
      header: 'Source',
      accessorKey: 'source',
      width: '100px',
      cell: (row) => (
        <span className="flex items-center gap-1 text-xs text-muted">
          {row.isAICreated ? (
            <span className="text-ai flex items-center gap-1 font-medium">
              <Mail className="w-3.5 h-3.5" /> AI
            </span>
          ) : (
            <span>{row.source}</span>
          )}
        </span>
      )
    }
  ];

  const handleDragStageChange = (rfqId: string, newStage: RFQItem['stage']) => {
    setRfqList(prev =>
      prev.map(r => r.id === rfqId ? { ...r, stage: newStage } : r)
    );
    setToastMessage(`${rfqId} moved to ${newStage}. Deadline reset to 22 Aug.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const boardStages: RFQItem['stage'][] = [
    'New',
    'Under review',
    'Costing',
    'Quoted',
    'Negotiation',
    'Won',
    'Lost'
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-strand-amber flex items-center gap-2.5 text-xs animate-fadeIn">
          <Clock className="w-4 h-4 text-strand-amber" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="RFQs & Work Tickets"
        actions={
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center bg-canvas border border-line rounded p-0.5 text-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded flex items-center gap-1.5 font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-ink shadow-2xs font-semibold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`px-2.5 py-1 rounded flex items-center gap-1.5 font-medium transition-colors ${
                  viewMode === 'board'
                    ? 'bg-white text-ink shadow-2xs font-semibold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
            </div>

            <button
              onClick={() => navigate('/inbox')}
              className="px-3 py-1.5 bg-kiran hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New RFQ Ticket
            </button>
          </div>
        }
      />

      {/* Main View Mode */}
      {viewMode === 'table' ? (
        <DataGrid
          data={filteredRFQs}
          columns={columns}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => navigate(`/rfq/${item.id}`)}
          searchPlaceholder="Search RFQ number, customer name, part no..."
          savedViews={savedViews}
          initialSortKey="rfqNumber"
          bulkActions={[
            {
              label: 'Reassign Owner',
              action: (items) => alert(`Reassigning ${items.length} RFQs`)
            },
            {
              label: 'Export Selected',
              action: (items) => alert(`Exporting ${items.length} RFQs to CSV`)
            }
          ]}
        />
      ) : (
        /* Board / Kanban View */
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-4 min-w-[1200px]">
            {boardStages.map((stage) => {
              const stageRFQs = filteredRFQs.filter((r) => r.stage === stage);

              return (
                <div
                  key={stage}
                  className="w-72 bg-surface border border-line rounded-lg shadow-card flex flex-col max-h-[calc(100vh-250px)] shrink-0"
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-line bg-canvas/60 flex items-center justify-between">
                    <span className="font-semibold text-xs text-ink font-mono ">
                      {stage}
                    </span>
                    <span className="font-mono text-[12px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold">
                      {stageRFQs.length}
                    </span>
                  </div>

                  {/* Column Cards */}
                  <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                    {stageRFQs.length === 0 ? (
                      <div className="py-8 text-center text-muted text-[12px] border border-dashed border-line rounded">
                        No tickets in {stage}
                      </div>
                    ) : (
                      stageRFQs.map((rfq) => (
                        <div
                          key={rfq.id}
                          onClick={() => navigate(`/rfq/${rfq.id}`)}
                          className="bg-white border border-line hover:border-kiran rounded p-3 shadow-xs space-y-2 cursor-pointer transition-all hover:shadow-sm group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold text-kiran">
                              {rfq.rfqNumber}
                            </span>
                            <StatusPill status={rfq.status} />
                          </div>

                          <div>
                            <h4 className="font-semibold text-xs text-ink leading-tight">
                              {rfq.customerName}
                            </h4>
                            <div className="font-mono text-[12px] text-slate-600 mt-0.5">
                              {rfq.partNumber}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[12px] text-muted font-mono pt-1 border-t border-line/60">
                            <span>{rfq.quantity.toLocaleString('en-IN')}m</span>
                            <span className="text-slate-800 font-semibold font-mono">
                              {formatINR(rfq.estimatedValue)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-[12px] text-muted">
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-4 rounded-full bg-ink text-white font-mono text-[8px] flex items-center justify-center">
                                {rfq.ownerName.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span>{rfq.ownerName}</span>
                            </div>
                            <AgeIndicator daysInStage={rfq.daysInStage} slaLimitDays={rfq.slaLimitDays} />
                          </div>

                          {/* Quick Stage Mover */}
                          <div className="pt-2 border-t border-line/40 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[12px] text-muted">Move to:</span>
                            <select
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleDragStageChange(rfq.id, e.target.value as any)}
                              value={rfq.stage}
                              className="text-[12px] bg-canvas border border-line rounded px-1 py-0.5 focus:outline-none"
                            >
                              {boardStages.map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
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
      )}
    </div>
  );
};
