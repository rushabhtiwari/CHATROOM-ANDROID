import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutGrid, List, Plus, CheckCircle2 } from 'lucide-react';
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
    { label: 'Mine', count: 6, active: activeSavedView === 'My tickets', onClick: () => setActiveSavedView('My tickets') },
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
      header: 'RFQ no.',
      accessorKey: 'rfqNumber',
      isMono: true,
      cell: (row) => (
        <Link to={`/rfq/${row.id}`} className="text-kiran hover:underline whitespace-nowrap">
          {row.rfqNumber}
        </Link>
      )
    },
    {
      id: 'customerName',
      header: 'Customer',
      accessorKey: 'customerName',
      cell: (row) => (
        <div className="whitespace-nowrap">
          <div className="font-medium text-ink">{row.customerName}</div>
          <div className="text-[12px] text-muted">{row.region}</div>
        </div>
      )
    },
    {
      id: 'partNumber',
      header: 'Part',
      accessorKey: 'partNumber',
      cell: (row) => (
        <div className="min-w-[180px]">
          <div className="text-ink whitespace-nowrap">{row.partNumber}</div>
          <div className="text-[12px] text-muted truncate max-w-[240px]" title={row.description}>
            {row.description}
          </div>
        </div>
      )
    },
    {
      id: 'quantity',
      header: 'Quantity',
      accessorKey: 'quantity',
      isNumeric: true,
      cell: (row) => (
        <span className="tabular-nums">{row.quantity.toLocaleString('en-IN')} {row.uom}</span>
      )
    },
    {
      id: 'sopDate',
      header: 'SOP date',
      accessorKey: 'sopDate',
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.sopDate)}</span>
    },
    {
      id: 'ownerName',
      header: 'Owner',
      accessorKey: 'ownerName',
      cell: (row) => <span className="whitespace-nowrap">{row.ownerName}</span>
    },
    {
      id: 'stage',
      header: 'Stage',
      accessorKey: 'stage',
      cell: (row) => <span className="whitespace-nowrap">{row.stage}</span>
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => (
        <span className="whitespace-nowrap inline-block">
          <StatusPill status={row.status} />
        </span>
      )
    },
    {
      id: 'daysInStage',
      header: 'Age',
      accessorKey: 'daysInStage',
      cell: (row) => <AgeIndicator daysInStage={row.daysInStage} slaLimitDays={row.slaLimitDays} />
    },
    {
      id: 'estimatedValue',
      header: 'Value',
      accessorKey: 'estimatedValue',
      isNumeric: true,
      cell: (row) => <IndianRupee amount={row.estimatedValue} />
    },
    {
      id: 'source',
      header: 'Source',
      accessorKey: 'source',
      cell: (row) => <span className="whitespace-nowrap">{row.isAICreated ? 'Email' : row.source}</span>
    }
  ];

  const handleDragStageChange = (rfqId: string, newStage: RFQItem['stage']) => {
    setRfqList(prev =>
      prev.map(r => r.id === rfqId ? { ...r, stage: newStage } : r)
    );
    setToastMessage(`${rfqId} moved to ${newStage}.`);
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

  const segment = (active: boolean) =>
    `h-7 px-3 rounded-sm text-[13px] font-medium flex items-center gap-1.5 transition-colors ${
      active ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-muted hover:text-ink'
    }`;

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-lg shadow-popover flex items-center gap-2.5 text-[14px] animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="RFQs"
        actions={
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-[#EBEBEF]">
              <button onClick={() => setViewMode('table')} className={segment(viewMode === 'table')}>
                <List className="w-3.5 h-3.5" />
                Table
              </button>
              <button onClick={() => setViewMode('board')} className={segment(viewMode === 'board')}>
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
            </div>

            <button onClick={() => navigate('/inbox')} className="btn-primary">
              <Plus className="w-4 h-4" />
              New RFQ
            </button>
          </div>
        }
      />

      {viewMode === 'table' ? (
        <DataGrid
          data={filteredRFQs}
          columns={columns}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => navigate(`/rfq/${item.id}`)}
          searchPlaceholder="Search RFQs"
          savedViews={savedViews}
          initialSortKey="rfqNumber"
          bulkActions={[
            {
              label: 'Reassign',
              action: (items) => alert(`Reassigning ${items.length} RFQs`)
            },
            {
              label: 'Export',
              action: (items) => alert(`Exporting ${items.length} RFQs to CSV`)
            }
          ]}
        />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-4 min-w-[1200px]">
            {boardStages.map((stage) => {
              const stageRFQs = filteredRFQs.filter((r) => r.stage === stage);

              return (
                <div key={stage} className="w-72 flex flex-col max-h-[calc(100vh-250px)] shrink-0">
                  <div className="px-1 pb-3 flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{stage}</span>
                    <span className="text-[13px] text-muted tabular-nums">{stageRFQs.length}</span>
                  </div>

                  <div className="space-y-3 overflow-y-auto flex-1">
                    {stageRFQs.length === 0 ? (
                      <div className="py-8 text-center text-muted text-[13px] border border-dashed border-line rounded-lg">
                        Empty
                      </div>
                    ) : (
                      stageRFQs.map((rfq) => (
                        <div
                          key={rfq.id}
                          onClick={() => navigate(`/rfq/${rfq.id}`)}
                          className="bg-surface border border-line hover:border-slate-300 rounded-lg p-4 space-y-3 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-code text-[13px] text-kiran whitespace-nowrap">
                              {rfq.rfqNumber}
                            </span>
                            <StatusPill status={rfq.status} />
                          </div>

                          <div>
                            <h4 className="font-medium text-[14px] text-ink leading-tight">
                              {rfq.customerName}
                            </h4>
                            <div className="text-[13px] text-muted mt-0.5">{rfq.partNumber}</div>
                          </div>

                          <div className="flex items-center justify-between text-[13px] text-muted">
                            <span className="tabular-nums">{rfq.quantity.toLocaleString('en-IN')}m</span>
                            <span className="text-ink tabular-nums">{formatINR(rfq.estimatedValue)}</span>
                          </div>

                          <div className="flex items-center justify-between text-[13px] text-muted">
                            <span>{rfq.ownerName}</span>
                            <AgeIndicator daysInStage={rfq.daysInStage} slaLimitDays={rfq.slaLimitDays} />
                          </div>

                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <select
                              aria-label="Move to stage"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleDragStageChange(rfq.id, e.target.value as any)}
                              value={rfq.stage}
                              className="field h-9 text-[13px]"
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
