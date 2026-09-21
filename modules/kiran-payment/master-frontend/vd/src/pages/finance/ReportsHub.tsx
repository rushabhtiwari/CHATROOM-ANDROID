import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockReportsList } from '../../data/reports';
import { PageHeader } from '../../components/shell/PageHeader';

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
    setToastMessage(`Running "${reportName}".`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover text-[13px] animate-fadeIn">
          {toastMessage}
        </div>
      )}

      <PageHeader title="Reports" />

      {/* Category filter */}
      <div className="inline-flex max-w-full overflow-x-auto rounded-md bg-[#EBEBEF] p-0.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            aria-pressed={selectedCat === cat}
            className={`h-8 rounded-sm px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
              selectedCat === cat ? 'bg-white text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="panel divide-y divide-line-2 overflow-hidden">
        {filteredReports.map((report) => (
          <div
            key={report.id}
            onClick={() => navigate(`/reports/${report.id}`)}
            className="flex min-h-[64px] cursor-pointer flex-wrap items-center justify-between gap-4 px-5 py-3.5 hover:bg-canvas"
          >
            <div className="min-w-0">
              <h3 className="text-[14px] font-medium text-ink">{report.name}</h3>
              <div className="text-[13px] text-muted">
                {report.category} · {report.schedule} · {report.lastRunAt}
              </div>
            </div>

            <button onClick={(e) => handleRunNow(report.name, e)} className="btn-secondary shrink-0">
              Run now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
