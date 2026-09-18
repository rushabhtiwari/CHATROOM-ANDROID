/**
 * A small anchored popover, and the rows that go in it.
 *
 * The console has Radix's dropdown-menu installed, but this module needs
 * something Radix's menu is not: a panel that stays open while you tick several
 * boxes, carries a search box at the top, closes on outside click, and can be
 * opened from a state dot inside a virtualised table cell. That is a popover
 * with checkable rows rather than a menu, so it is written here.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

interface DropdownProps {
  /** The trigger. Receives whether the panel is open so it can show a state. */
  trigger: (open: boolean) => React.ReactNode;
  /** Static content, or a render function given `close` and the search query. */
  children: React.ReactNode | ((close: () => void, query: string) => React.ReactNode);
  align?: 'left' | 'right';
  /** Panel width; the search-bearing ones need more room. */
  width?: string;
  className?: string;
  /** Adds a search box at the top and passes its query to `children`. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Called when the panel opens or closes. */
  onOpenChange?: (open: boolean) => void;
}

/** Roughly the tallest a panel gets; used to decide whether to flip upward. */
const MAX_PANEL_HEIGHT = 352;

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  align = 'left',
  width = 'w-56',
  className = '',
  searchable = false,
  searchPlaceholder = 'Search',
  onOpenChange,
}) => {
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, right: 0, flip: false });
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpenState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        if (value !== prev) onOpenChange?.(value);
        if (!value) setQuery('');
        return value;
      });
    },
    [onOpenChange],
  );

  /*
   * The panel is portalled to the body rather than positioned inside the
   * trigger. The List and Table layouts are virtualised, and every virtual row
   * carries a transform, which creates a stacking context — an absolutely
   * positioned panel inside row 3 paints beneath rows 4, 5 and 6 whatever its
   * z-index. Portalling escapes those contexts entirely.
   */
  const place = useCallback(() => {
    const el = root.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      right: window.innerWidth - rect.right,
      flip: spaceBelow < Math.min(MAX_PANEL_HEIGHT, 240) && rect.top > spaceBelow,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    };
    // Escape closes the dropdown before the peek panel sees it, so one press
    // does one thing.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    // A portalled panel does not travel with its trigger, so scrolling the list
    // under it would leave it stranded. Closing is the honest response.
    const onScroll = (event: Event) => {
      if (panel.current && event.target instanceof Node && panel.current.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, setOpen]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <div ref={root} className={`relative inline-flex ${className}`}>
      <div
        className="inline-flex min-w-0"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        {trigger(open)}
      </div>

      {open &&
        createPortal(
          <div
            ref={panel}
            onClick={(event) => event.stopPropagation()}
            style={
              position.flip
                ? {
                    position: 'fixed',
                    bottom: window.innerHeight - position.top + 8,
                    ...(align === 'right' ? { right: position.right } : { left: position.left }),
                  }
                : {
                    position: 'fixed',
                    top: position.top,
                    ...(align === 'right' ? { right: position.right } : { left: position.left }),
                  }
            }
            className={`z-[70] ${width} flex max-h-[22rem] flex-col rounded-lg border border-line bg-white shadow-popover`}
          >
            {searchable && (
              <div className="flex items-center gap-1.5 border-b border-line-2 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-[12px] text-ink placeholder:text-muted focus:outline-none"
                />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {typeof children === 'function' ? children(close, query) : children}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

export const DropdownLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted">
    {children}
  </div>
);

export const DropdownSeparator: React.FC = () => <div className="my-1 border-t border-line-2" />;

/** A plain line of text inside a panel, for empty states and hints. */
export const DropdownNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="px-2.5 py-2 text-[12px] text-muted">{children}</p>
);

/**
 * One selectable row. `selected` renders a check on the right rather than a
 * checkbox on the left, which keeps every row's text on the same left edge.
 */
export const DropdownItem: React.FC<{
  onSelect: () => void;
  selected?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  trailing?: React.ReactNode;
}> = ({ onSelect, selected, icon, children, danger, disabled, trailing }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={(event) => {
      event.stopPropagation();
      if (!disabled) onSelect();
    }}
    className={`mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded px-1.5 py-[5px] text-left text-[12.5px] transition-colors ${
      disabled
        ? 'cursor-not-allowed text-slate-300'
        : danger
          ? 'text-strand-red hover:bg-red-50'
          : 'text-slate-700 hover:bg-canvas'
    }`}
  >
    {icon && <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>}
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {trailing}
    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-kiran" />}
  </button>
);

/** The standard toolbar button, so every control on the header row matches. */
export const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  {
    active?: boolean;
    children: React.ReactNode;
    chevron?: boolean;
    className?: string;
    onClick?: () => void;
    title?: string;
    primary?: boolean;
  }
>(({ active, children, chevron, className = '', onClick, title, primary }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    title={title}
    className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors ${
      primary
        ? 'border-kiran bg-kiran text-white hover:bg-brand-600'
        : active
          ? 'border-line bg-canvas text-ink'
          : 'border-line bg-white text-slate-700 hover:bg-canvas'
    } ${className}`}
  >
    {children}
    {chevron && <ChevronDown className="h-3 w-3 opacity-60" />}
  </button>
));

ToolbarButton.displayName = 'ToolbarButton';
