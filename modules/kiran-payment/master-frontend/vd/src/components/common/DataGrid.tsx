import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square
} from 'lucide-react';

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  isNumeric?: boolean;
  isMono?: boolean;
  sortable?: boolean;
  width?: string;
}

interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  searchPlaceholder?: string;
  searchKey?: keyof T | ((item: T) => string);
  bulkActions?: {
    label: string;
    action: (selectedItems: T[]) => void;
    variant?: 'default' | 'danger';
  }[];
  customFilters?: React.ReactNode;
  savedViews?: { label: string; count?: number; active: boolean; onClick: () => void }[];
  title?: string;
  initialSortKey?: string;
  initialSortDir?: 'asc' | 'desc';
  pageSize?: number;
  className?: string;
}

export function DataGrid<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  searchPlaceholder = 'Search records...',
  searchKey,
  bulkActions = [],
  customFilters,
  savedViews,
  title,
  initialSortKey,
  initialSortDir = 'desc',
  pageSize = 15,
  className = ''
}: DataGridProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDir);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCompact, setIsCompact] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter Data
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();

    return data.filter((item) => {
      if (typeof searchKey === 'function') {
        return searchKey(item).toLowerCase().includes(term);
      }
      if (searchKey && item[searchKey]) {
        return String(item[searchKey]).toLowerCase().includes(term);
      }
      // Fallback search across all string/number fields
      return Object.values(item as any).some((val) =>
        String(val || '').toLowerCase().includes(term)
      );
    });
  }, [data, searchTerm, searchKey]);

  // Sort Data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = columns.find((c) => c.id === sortKey);
    if (!col) return filteredData;

    return [...filteredData].sort((a: any, b: any) => {
      let aVal = col.accessorKey ? a[col.accessorKey] : a[sortKey];
      let bVal = col.accessorKey ? b[col.accessorKey] : b[sortKey];

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredData, sortKey, sortDir, columns]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Selection
  const allPageIdsSelected =
    paginatedData.length > 0 &&
    paginatedData.every((item) => selectedIds.has(keyExtractor(item)));

  const toggleSelectAllPage = () => {
    const newSet = new Set(selectedIds);
    if (allPageIdsSelected) {
      paginatedData.forEach((item) => newSet.delete(keyExtractor(item)));
    } else {
      paginatedData.forEach((item) => newSet.add(keyExtractor(item)));
    }
    setSelectedIds(newSet);
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSort = (colId: string) => {
    if (sortKey === colId) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(colId);
      setSortDir('asc');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = columns.map((c) => c.header).join(',');
    const rows = sortedData.map((item: any) =>
      columns
        .map((c) => {
          const val = c.accessorKey ? item[c.accessorKey] : item[c.id];
          const str = String(val ?? '').replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kiran_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedItems = data.filter((item) => selectedIds.has(keyExtractor(item)));

  return (
    <div className={`w-full bg-surface border border-line rounded-lg shadow-card flex flex-col overflow-hidden ${className}`}>
      {/* Top Header & Filter Controls */}
      <div className="p-4 border-b border-line space-y-3">
        {/* Saved Views (if present) */}
        {savedViews && savedViews.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted mr-1">Views:</span>
            {savedViews.map((sv, idx) => (
              <button
                key={idx}
                onClick={sv.onClick}
                className={`px-2.5 py-1 rounded-badge text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                  sv.active
                    ? 'bg-kiran text-white shadow-xs'
                    : 'bg-canvas text-slate hover:bg-line/60 border border-line'
                }`}
              >
                <span>{sv.label}</span>
                {sv.count !== undefined && (
                  <span
                    className={`font-mono text-[10px] px-1 rounded ${
                      sv.active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {sv.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-canvas border border-line rounded focus:outline-none focus:ring-1 focus:ring-kiran focus:bg-white text-ink"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {customFilters}
            
            <button
              onClick={() => setIsCompact(!isCompact)}
              className="p-1.5 text-slate hover:text-ink rounded border border-line hover:bg-canvas text-xs flex items-center gap-1"
              title={isCompact ? 'Comfortable view' : 'Compact view'}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 text-xs font-medium text-slate hover:text-ink bg-white border border-line hover:bg-canvas rounded flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-muted" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (appears when items selected) */}
        {selectedIds.size > 0 && (
          <div className="p-2 bg-kiran-tint border border-kiran/30 rounded flex items-center justify-between text-xs text-kiran font-medium animate-fadeIn">
            <span className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              <span>{selectedIds.size} row(s) selected</span>
            </span>
            <div className="flex items-center gap-2">
              {bulkActions.map((ba, idx) => (
                <button
                  key={idx}
                  onClick={() => ba.action(selectedItems)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold shadow-xs ${
                    ba.variant === 'danger'
                      ? 'bg-strand-red text-white hover:bg-red-700'
                      : 'bg-kiran text-white hover:bg-blue-700'
                  }`}
                >
                  {ba.label}
                </button>
              ))}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-500 hover:underline ml-2"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="w-full overflow-x-auto relative min-h-[300px]">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead className="bg-surface-2/95 backdrop-blur-sm text-muted text-[10px] font-semibold uppercase tracking-[0.09em] border-b border-line sticky top-0 z-10 select-none">
            <tr>
              <th className="w-10 px-3 py-2 text-center">
                <button
                  onClick={toggleSelectAllPage}
                  className="text-muted hover:text-ink focus:outline-none"
                >
                  {allPageIdsSelected ? (
                    <CheckSquare className="w-4 h-4 text-kiran" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300" />
                  )}
                </button>
              </th>
              {columns.map((col, idx) => (
                <th
                  key={col.id}
                  style={{ width: col.width }}
                  onClick={() => col.sortable !== false && handleSort(col.id)}
                  className={`px-3 py-2.5 whitespace-nowrap ${
                    col.isNumeric ? 'text-right' : 'text-left'
                  } ${
                    col.sortable !== false ? 'cursor-pointer hover:text-ink hover:bg-line/40' : ''
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-1 ${
                      col.isNumeric ? 'justify-end w-full' : ''
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortable !== false && (
                      <span className="text-slate-400">
                        {sortKey === col.id ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="w-3 h-3 text-kiran" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-kiran" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-6 py-12 text-center text-muted"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="w-8 h-8 text-slate-300 stroke-1" />
                    <p className="text-sm font-medium text-slate-700">No records found</p>
                    <p className="text-xs text-muted">Try adjusting your filters or search query.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((item, rowIdx) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds.has(id);

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={`transition-colors duration-100 border-b border-line-2 ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${
                      isSelected
                        ? 'bg-kiran-tint'
                        : 'hover:bg-canvas/70'
                    } ${isCompact ? 'h-9' : 'h-11'}`}
                  >
                    <td
                      className="w-10 px-3 py-1.5 text-center"
                      onClick={(e) => toggleSelectOne(id, e)}
                    >
                      <button className="focus:outline-none">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-kiran" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                        )}
                      </button>
                    </td>

                    {columns.map((col, cIdx) => {
                      const val = col.accessorKey ? (item as any)[col.accessorKey] : (item as any)[col.id];
                      return (
                        <td
                          key={col.id}
                          className={`px-3 py-1.5 ${
                            col.isNumeric ? 'text-right' : 'text-left'
                          } ${col.isMono ? 'font-mono text-xs' : ''} ${
                            cIdx === 0 ? 'font-semibold text-ink' : 'text-slate'
                          }`}
                        >
                          {col.cell ? col.cell(item) : String(val ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs text-muted bg-surface-2">
        <div>
          Showing <strong className="font-mono text-ink">{sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong>–
          <strong className="font-mono text-ink">{Math.min(currentPage * pageSize, sortedData.length)}</strong> of{' '}
          <strong className="font-mono text-ink">{sortedData.length}</strong> records
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-sm border border-line bg-surface text-slate disabled:opacity-40 disabled:cursor-not-allowed hover:bg-canvas hover:text-ink transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono px-2 text-ink">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-sm border border-line bg-surface text-slate disabled:opacity-40 disabled:cursor-not-allowed hover:bg-canvas hover:text-ink transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
