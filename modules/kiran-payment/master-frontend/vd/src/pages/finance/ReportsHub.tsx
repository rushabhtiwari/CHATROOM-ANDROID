import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockReportsList } from '../../data/reports';
import { PageHeader } from '../../components/shell/PageHeader';
import {
  BarChart3,
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
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Executive Reports & MIS Hub"
      />

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`px-3 py-1.5 rounded-badge text-xs font-semibold transition-colors ${
              selectedCat === cat
                ? 'bg-ink text-white shadow-xs'
                : 'bg-surface text-slate-700 hover:bg-canvas border border-line'
            }`}
          >
            {cat} Reports
          </button>
        ))}
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredReports.map((report) => (
          <div
            key={report.id}
            onClick={() => navigate(`/reports/${report.id}`)}
            className="bg-surface border border-line hover:border-kiran rounded-md p-5 shadow-card hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-kiran-tint text-kiran flex items-center justify-center shrink-0">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-ink group-hover:text-kiran transition-colors">
                      {report.name}
                    </h3>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
                      {report.category} Module
                    </span>
                  </div>
                </div>

                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-canvas border border-line text-slate-700">
                  {report.schedule}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {report.description}
              </p>

              {/* AI Narrative Preview Teaser */}
              <div className="p-2.5 rounded bg-ai-tint/30 border border-ai/20 text-[11px] text-ai space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Latest AI Takeaway ({report.aiSummary.generatedByModel}):
                </div>
                <div className="text-slate-700 italic line-clamp-1">
                  "{report.aiSummary.points[0]}"
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-muted text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>Last run: {report.lastRunAt}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleRunNow(report.name, e)}
                  className="px-2.5 py-1 rounded bg-canvas hover:bg-slate-200 border border-line text-[11px] font-medium text-slate-700 flex items-center gap-1"
                >
                  <Play className="w-3 h-3 text-kiran" />
                  <span>Run now</span>
                </button>
                <span className="text-xs font-semibold text-kiran flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Open report</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
