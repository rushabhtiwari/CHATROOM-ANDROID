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

/**
 * Tabs — LEDGERDESIGNSYSTEM.md §5.6.
 *
 * The active tab's 2px accent rule sits *on* the container's hairline via
 * `-mb-px`, so the two read as one continuous line rather than as a rule
 * floating above a border. The count chip inverts on the active tab: accent
 * ground with dark ink on it, never white.
 */
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
      className={`ku-scrollbar flex overflow-x-auto border-b border-hairline ${className}`}
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
            className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-body-s transition-colors duration-150 ${
              isActive
                ? 'border-accent font-semibold text-ink'
                : 'border-transparent text-meta hover:text-ink'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`tnum px-2 py-0.5 font-mono text-caption font-semibold ${
                  isActive ? 'bg-accent text-accent-ink' : 'bg-canvas text-meta'
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
