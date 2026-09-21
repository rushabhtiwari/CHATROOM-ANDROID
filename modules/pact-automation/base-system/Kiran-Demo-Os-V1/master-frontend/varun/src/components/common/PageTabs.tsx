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
  /** Retained for call-site compatibility; the system spends one accent. */
  departmentColor?: string;
  className?: string;
}

/** Segmented control: 32px track, white selected segment. */
export const PageTabs: React.FC<PageTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = ''
}) => {
  return (
    <div
      role="tablist"
      aria-label="Page sections"
      className={`ku-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-[#EBEBEF] p-0.5 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-sm px-3.5 text-caption font-medium transition-colors duration-150 ${
              isActive ? 'bg-white text-ink' : 'text-meta hover:text-ink'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className="tnum text-caption font-medium text-faint"
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
