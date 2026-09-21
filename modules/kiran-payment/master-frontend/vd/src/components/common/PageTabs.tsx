import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number | string;
  badgeColor?: string;
}

interface PageTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  departmentColor?: string; // e.g. '#B5070E', '#E9991B', '#018F3D', '#00AEEF'
  className?: string;
}

export const PageTabs: React.FC<PageTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  departmentColor: _departmentColor, // kept for callers; tabs are one blue
  className = ''
}) => {
  return (
    <div className={`border-b border-line flex items-center gap-6 overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`h-10 text-[14px] font-medium transition-colors relative border-b-2 flex items-center gap-2 whitespace-nowrap focus:outline-none ${
              isActive ? 'border-kiran text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className="text-[12px] text-[#6E6E76] tabular-nums"
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
