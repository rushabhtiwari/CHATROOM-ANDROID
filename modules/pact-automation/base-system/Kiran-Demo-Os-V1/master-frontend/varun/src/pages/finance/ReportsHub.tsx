import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockReportsList } from '../../data/reports';
import { PageHeader } from '../../components/shell/PageHeader';
import {
  Calendar,
  Clock,
  Play,
  ArrowRight,
  FileSpreadsheet,
  Users,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export const ReportsHub: React.FC = () => {
  const navigate = useNavigate();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const categories = ['All', 'Sales', 'Accounts', 'Purchase', 'Projects'];
  const [selectedCat, setSelectedCat] = useState('All');

  const filteredReports = mockReportsList.filter((r) => {
    if (selectedCat !== 'All' && r.category !== selectedCat) return false;
    return true;
  });

  const handleRunNow = (reportName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setToastMessage(`Running instant generation for "${reportName}"... Narrative updated.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="animate-fadeIn fixed right-8 top-16 z-50 flex items-center gap-2.5 border border-ink border-l-6 border-l-accent bg-structure px-4 py-3 text-body-s text-white">
          <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-accent" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Executive Reports & MIS Hub"
      />

      {/*
        Category filters are tabs, not pills (§5.6): the active tab's 2px accent
        rule sits ON the container hairline via -mb-px, so the two read as one
        continuous line.
      */}
      <div role="tablist" aria-label="Report categories" className="ku-scrollbar -mt-2 flex overflow-x-auto border-b border-hairline">
        {categories.map((cat) => {
          const isActive = selectedCat === cat;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedCat(cat)}
              className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-body-s transition-colors duration-150 ${
                isActive
                  ? 'border-accent font-semibold text-ink'
                  : 'border-transparent text-meta hover:text-ink'
              }`}
            >
              {cat} Reports
            </button>
          );
        })}
      </div>

      {/*
        The report shelf is ONE ruled sheet, not a `gap-6` grid of cards — a
        hairline under each entry, and the accent rule that follows the pointer
        down the page in place of zebra striping (§5.7).
      */}
      <div className="ku-sheet">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <p className="ku-eyebrow">Report shelf</p>
            <h2 className="mt-1.5 font-display text-h3 font-semibold text-ink">
              {selectedCat === 'All'
                ? 'Everything scheduled against the ledger'
                : `Everything the ${selectedCat.toLowerCase()} module reports on`}
            </h2>
          </div>
          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div>
              <dt className="ku-eyebrow">On view</dt>
              <dd className="ku-fig mt-0.5 text-body font-semibold text-ink">{filteredReports.length}</dd>
            </div>
          </dl>
        </div>

        <ul className="ku-ruled">
          {filteredReports.map((report) => (
            <li key={report.id} className="ku-row">
              <div
                onClick={() => navigate(`/reports/${report.id}`)}
                className="flex cursor-pointer flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:gap-8"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                    <span className="ku-docket">{report.category} Module</span>
                    <span className="font-display text-body font-semibold text-ink">
                      {report.name}
                    </span>
                    <span className="ku-stamp border-st-grey-ink text-st-grey-ink">
                      {report.schedule}
                    </span>
                  </div>

                  <p className="mt-1.5 max-w-[80ch] text-body-s leading-6 text-meta">
                    {report.description}
                  </p>

                  {/* The overnight read: a pulled-out note on a 6px accent
                      rule, rather than a tinted rounded tile. */}
                  <div className="ku-rule-accent mt-3">
                    <p className="ku-eyebrow flex items-center gap-1.5">
                      <Sparkles aria-hidden size={11} className="shrink-0" />
                      Latest takeaway · {report.aiSummary.generatedByModel}
                    </p>
                    <p className="mt-1 max-w-[80ch] text-body-s italic leading-6 text-ink">
                      &ldquo;{report.aiSummary.points[0]}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3 lg:w-[300px] lg:flex-col lg:items-end">
                  <span className="flex items-center gap-1.5 text-caption text-meta">
                    <Clock aria-hidden className="h-3.5 w-3.5" />
                    Last run <span className="ku-fig">{report.lastRunAt}</span>
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => handleRunNow(report.name, e)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline-strong bg-white px-3 text-body-s font-medium leading-none text-ink transition-colors duration-150 hover:bg-canvas"
                    >
                      <Play aria-hidden className="h-3 w-3" />
                      Run now
                    </button>
                    <span className="flex items-center gap-1 text-body-s font-semibold text-accent-link">
                      Open report
                      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
