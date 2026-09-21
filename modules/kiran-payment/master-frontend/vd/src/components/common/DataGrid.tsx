import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
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
    <div className={`w-full bg-surface border border-line rounded-lg flex flex-col overflow-hidden ${className}`}>
      {/* Top Header & Filter Controls */}
      <div className="px-5 py-4 border-b border-line space-y-4">
        {/* Saved Views (if present) */}
        {savedViews && savedViews.length > 0 && (
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-[#EBEBEF] overflow-x-auto max-w-full">
            {savedViews.map((sv, idx) => (
              <button
                key={idx}
                onClick={sv.onClick}
                className={`h-7 px-3 rounded-sm text-[13px] font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                  sv.active
                    ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <span>{sv.label}</span>
                {sv.count !== undefined && (
                  <span
                    className="text-[12px] text-[#6E6E76] tabular-nums"
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
              <Search className="w-4 h-4 text-[#6E6E76] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 pl-9 pr-3 text-[14px] bg-white border border-[#D8D8DE] rounded-md focus:outline-none focus:border-kiran focus:ring-2 focus:ring-kiran/15 text-ink placeholder:text-[#6E6E76]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {customFilters}
            
            <button
              onClick={() => setIsCompact(!isCompact)}
              className="w-9 h-9 inline-flex items-center justify-center text-[#6E6E76] hover:text-ink rounded-md hover:bg-black/[0.05]"
              title={isCompact ? 'Comfortable view' : 'Compact view'}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              onClick={handleExportCSV}
              className="h-9 px-3.5 text-[14px] font-medium text-ink bg-white border border-[#D8D8DE] hover:bg-[#F4F4F6] rounded-md flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-[#6E6E76]" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (appears when items selected) */}
        {selectedIds.size > 0 && (
          <div className="px-3 py-2 bg-kiran-tint rounded-md flex items-center justify-between text-[13px] text-[#0B4F9C] font-medium animate-fadeIn">
            <span className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              <span>{selectedIds.size} selected</span>
            </span>
            <div className="flex items-center gap-2">
              {bulkActions.map((ba, idx) => (
                <button
                  key={idx}
                  onClick={() => ba.action(selectedItems)}
                  className={`h-8 px-3 rounded-md text-[13px] font-medium ${
                    ba.variant === 'danger'
                      ? 'bg-white border border-[#D8D8DE] text-strand-red hover:bg-[#FBE9E7]'
                      : 'bg-white border border-[#D8D8DE] text-ink hover:bg-[#F4F4F6]'
                  }`}
                >
                  {ba.label}
                </button>
              ))}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[13px] text-muted hover:text-ink ml-2"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="w-full overflow-x-auto relative min-h-[300px]">
        <table className="w-full text-left border-collapse text-[14px]">
          <thead className="bg-surface-2 text-muted text-[13px] font-medium border-b border-line sticky top-0 z-10 select-none">
            <tr>
              <th className="w-12 pl-5 pr-2 h-11 text-center">
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
                  className={`px-4 h-11 font-medium whitespace-nowrap ${
                    col.isNumeric ? 'text-right' : 'text-left'
                  } ${
                    col.sortable !== false ? 'cursor-pointer hover:text-ink' : ''
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-1 ${
                      col.isNumeric ? 'justify-end w-full' : ''
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortable !== false && sortKey === col.id && (
                      sortDir === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#6E6E76]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#6E6E76]" />
                      )
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
                    <p className="text-[14px] text-muted">Nothing matches.</p>
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
                        : 'hover:bg-canvas'
                    } ${isCompact ? 'h-10' : 'h-[52px]'}`}
                  >
                    <td
                      className="w-12 pl-5 pr-2 py-1.5 text-center"
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
                          className={`px-4 py-2 ${
                            col.isNumeric ? 'text-right whitespace-nowrap' : 'text-left'
                          } ${col.isMono ? (cIdx === 0 ? 'font-code text-[13px] whitespace-nowrap' : 'font-mono whitespace-nowrap') : ''} ${
                            cIdx === 0 ? 'font-medium text-ink whitespace-nowrap' : 'text-ink-3'
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
      <div className="px-5 h-[52px] border-t border-line flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <div>
          {sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
          {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-9 h-9 inline-flex items-center justify-center rounded-md text-[#6E6E76] disabled:opacity-35 disabled:cursor-not-allowed hover:bg-black/[0.05] hover:text-ink transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-ink tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-9 h-9 inline-flex items-center justify-center rounded-md text-[#6E6E76] disabled:opacity-35 disabled:cursor-not-allowed hover:bg-black/[0.05] hover:text-ink transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
