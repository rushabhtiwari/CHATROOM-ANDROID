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
  departmentColor = '#06477F', // default Kiran blue
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
            style={{
              borderBottomColor: isActive ? departmentColor : 'transparent',
              color: isActive ? '#0E2340' : '#7A8798'
            }}
            className={`pb-2.5 pt-1 text-xs font-semibold tracking-tight transition-all relative border-b-2 flex items-center gap-1.5 whitespace-nowrap focus:outline-none ${
              isActive ? 'font-semibold' : 'hover:text-slate'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                  isActive
                    ? 'bg-ink text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
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
