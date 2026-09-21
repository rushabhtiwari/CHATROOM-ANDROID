import React, { useState, useMemo } from 'react';
import {
  Download,
  Search,
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
  const [isCompact, setIsCompact] = useState(true);
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
    <div className={`ku-card flex w-full flex-col overflow-hidden ${className}`}>
      {/* Top Header & Filter Controls */}
      <div className="space-y-4 border-b border-hairline bg-white p-4 sm:p-5">
        {/* Saved Views (if present) */}
        {savedViews && savedViews.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="ku-eyebrow mr-1 shrink-0">Views</span>
            {savedViews.map((sv, idx) => (
              <button
                type="button"
                key={idx}
                onClick={sv.onClick}
                className={`flex shrink-0 items-center gap-1.5 border px-2.5 py-1 text-caption font-semibold leading-none transition-colors duration-150 ${
                  sv.active
                    ? 'border-ink bg-accent text-white'
                    : 'border-hairline-strong bg-white text-ink hover:bg-canvas'
                }`}
              >
                <span>{sv.label}</span>
                {sv.count !== undefined && (
                  <span
                    className={`ku-fig px-1 text-micro ${
                      sv.active ? 'bg-ink/10 text-white' : 'bg-canvas text-meta'
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
              <Search aria-hidden className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-hairline-strong" />
              <input
                type="text"
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full min-w-0 rounded-md border border-hairline-strong bg-white py-2 pl-8 pr-3 text-body-s text-ink transition-colors duration-150 placeholder:text-meta focus:border-accent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {customFilters}
            
            <button
              type="button"
              onClick={() => setIsCompact(!isCompact)}
              aria-label={isCompact ? 'Switch to comfortable row spacing' : 'Switch to compact row spacing'}
              aria-pressed={isCompact}
              title={isCompact ? 'Switch to comfortable row spacing' : 'Switch to compact row spacing'}
              className="flex h-9 w-9 items-center justify-center border border-hairline-strong bg-white text-ink transition-colors duration-150 hover:bg-canvas"
            >
              <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex h-9 items-center gap-1.5 rounded-md border border-hairline-strong bg-white px-3 text-body-s font-medium leading-none text-ink transition-colors duration-150 hover:bg-canvas"
            >
              <Download aria-hidden className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (appears when items selected) */}
        {selectedIds.size > 0 && (
          <div className="animate-fadeIn flex items-center justify-between gap-3 rounded-md border-l-accent bg-canvas p-2.5 text-body-s text-ink">
            <span className="flex items-center gap-2">
              <CheckSquare aria-hidden className="h-4 w-4 text-meta" />
              <span>
                <span className="ku-fig font-semibold">{selectedIds.size}</span> row
                {selectedIds.size === 1 ? '' : 's'} selected
              </span>
            </span>
            <div className="flex items-center gap-2">
              {bulkActions.map((ba, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => ba.action(selectedItems)}
                  className={`border px-3 py-1.5 text-body-s font-semibold leading-none transition-colors duration-150 ${
                    ba.variant === 'danger'
                      ? 'border-danger bg-danger text-white hover:brightness-95'
                      : 'border-ink bg-accent text-white hover:bg-accent-hover'
                  }`}
                >
                  {ba.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="ml-2 text-body-s text-meta underline-offset-4 hover:text-ink hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="ku-scrollbar relative min-h-[300px] w-full overflow-x-auto bg-white">
        <table className="w-full border-collapse text-left text-body-s">
          {/*
            A 2px structure rule under the whole head — not a grey border-b.
            It is drawn as an ::after inside each cell because under
            border-collapse the head's bottom border belongs to the table's
            border grid, so it scrolls away from a sticky <th> in Chromium.
          */}
          <thead className="select-none">
            <tr className="">
              <th
                scope="col"
                className="sticky top-0 z-10 w-10 bg-white px-3 py-2.5 text-center after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-structure after:content-['']"
              >
                <button
                  onClick={toggleSelectAllPage}
                  aria-label={allPageIdsSelected ? 'Clear selection on this page' : 'Select all rows on this page'}
                  aria-pressed={allPageIdsSelected}
                  title={allPageIdsSelected ? 'Clear selection on this page' : 'Select all rows on this page'}
                  className="text-hairline-strong transition-colors duration-150 hover:text-ink"
                >
                  {allPageIdsSelected ? (
                    <CheckSquare aria-hidden className="h-4 w-4 text-ink" />
                  ) : (
                    <Square aria-hidden className="h-4 w-4" />
                  )}
                </button>
              </th>
              {columns.map((col, idx) => (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={sortKey === col.id ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  style={{ width: col.width }}
                  className={`ku-narrow sticky top-0 z-10 whitespace-nowrap bg-white px-3 py-2.5 align-bottom text-micro font-semibold text-meta after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-structure after:content-[''] ${
                    col.isNumeric ? 'text-right' : 'text-left'
                  } ${col.sortable !== false ? 'cursor-pointer hover:text-ink' : ''}`}
                >
                  <div
                    className={`inline-flex items-center gap-1 ${
                      col.isNumeric ? 'justify-end w-full' : ''
                    }`}
                  >
                    {col.sortable !== false ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.id)}
                        aria-label={`Sort by ${col.header}`}
                        className="inline-flex items-center gap-1.5 text-left hover:text-ink"
                      >
                        <span>{col.header}</span>
                        <span
                          aria-hidden="true"
                          className={`font-mono ${sortKey === col.id ? 'text-ink' : 'text-hairline-strong'}`}
                        >
                          {sortKey === col.id ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    ) : (
                      <span>{col.header}</span>
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
                  className="px-6 py-14"
                >
                  <div className="flex flex-col items-start text-left">
                    <span aria-hidden className="block h-0.5 w-7 origin-left animate-rule-in bg-accent" />
                    <div className="mt-3.5 flex items-center gap-2">
                      <Search aria-hidden size={13} className="shrink-0 text-hairline-strong" />
                      <span className="ku-eyebrow">Nothing on file</span>
                    </div>
                    <p className="mt-2 font-display text-h3 font-semibold text-ink">
                      No records match this view
                    </p>
                    <p className="mt-2 max-w-[54ch] text-body-s leading-relaxed text-meta">
                      Widen the search, or clear a filter, and the ledger will fill again.
                    </p>
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
                    onKeyDown={(event) => {
                      if (onRowClick && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        onRowClick(item);
                      }
                    }}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-selected={isSelected}
                    className={`border-b border-hairline border-l-3 bg-white transition-colors duration-150 last:border-b-0 ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${
                      isSelected
                        ? 'border-l-accent bg-canvas'
                        : 'border-l-transparent hover:bg-canvas'
                    } ${isCompact ? 'h-9' : 'h-11'}`}
                  >
                    <td
                      className="w-10 px-3 py-1.5 text-center"
                    >
                      <button
                        type="button"
                        onClick={(event) => toggleSelectOne(id, event)}
                        aria-label={isSelected ? `Deselect row ${id}` : `Select row ${id}`}
                        aria-pressed={isSelected}
                        className="text-hairline-strong transition-colors duration-150 hover:text-ink"
                      >
                        {isSelected ? (
                          <CheckSquare aria-hidden className="h-4 w-4 text-ink" />
                        ) : (
                          <Square aria-hidden className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    {columns.map((col, cIdx) => {
                      const val = col.accessorKey ? (item as any)[col.accessorKey] : (item as any)[col.id];
                      return (
                        <td
                          key={col.id}
                          className={`px-3 py-1.5 align-middle ${
                            col.isNumeric ? 'ku-fig text-right text-ink' : 'text-left'
                          } ${col.isMono ? 'ku-fig text-caption' : ''} ${
                            cIdx === 0 ? 'font-semibold text-ink' : 'text-ink-soft'
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
      {/* Prose stays sans; only the figures inside it take the mono voice. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-canvas px-4 py-3 text-body-s text-meta">
        <div>
          Showing <span className="ku-fig font-semibold text-ink">{sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span>–
          <span className="ku-fig font-semibold text-ink">{Math.min(currentPage * pageSize, sortedData.length)}</span> of{' '}
          <span className="ku-fig font-semibold text-ink">{sortedData.length}</span> records
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
            title="Previous page"
            className="flex h-8 w-8 items-center justify-center border border-hairline-strong bg-white text-ink transition-colors duration-150 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </button>
          <span className="ku-fig px-2 font-semibold text-ink">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            title="Next page"
            className="flex h-8 w-8 items-center justify-center border border-hairline-strong bg-white text-ink transition-colors duration-150 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
