import { cx } from '@/lib/format';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

/**
 * Underline tabs. The active tab's 2px orange rule sits on the container's hairline
 * bottom border (via -mb-px) so the two read as one line.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx(
        'flex overflow-x-auto border-b border-hairline [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cx(
              '-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-body transition-colors duration-150',
              isActive
                ? 'border-orangy font-semibold text-rich-black'
                : 'border-transparent text-meta hover:text-rich-black',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={cx(
                  'tnum px-2 py-0.5 text-caption font-semibold',
                  isActive ? 'bg-orangy text-rich-black' : 'bg-canvas text-meta',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
