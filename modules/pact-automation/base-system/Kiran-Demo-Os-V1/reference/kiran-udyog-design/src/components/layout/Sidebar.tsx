// The navy rail. Navigation is grouped into labelled sections so each team owns its own
// part of the system — HR and Accounts are deliberately separate sections.
//
// The rail is the one constant in the product, so it carries the masthead: Kiran Udyog
// as the parentage, RTS as the system. The active item is *carved into* the navy — a
// darker well plus the orange rule — rather than a lighter chip floating on top of it.

import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { NAV_SECTIONS } from '@/context/AppContext';
import type { NavItem } from '@/context/AppContext';
import { cx } from '@/lib/format';

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps): JSX.Element {
  return (
    <>
      {/* Scrim — only ever visible while the off-canvas drawer is open under lg. */}
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onMobileClose}
        className={cx(
          'fixed inset-0 z-40 bg-rich-black/60 transition-opacity duration-150 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none invisible opacity-0',
        )}
      />

      <aside
        aria-label="Primary navigation"
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex h-full shrink-0 flex-col overflow-hidden',
          'bg-darkey-bluey transition-[width,transform] duration-150 ease-out',
          'lg:static lg:translate-x-0 lg:visible',
          mobileOpen ? 'translate-x-0' : 'invisible -translate-x-full',
          collapsed ? 'w-18' : 'w-64',
        )}
      >
        {/* Masthead — parentage above, system name set wide against the orange rule. */}
        <div
          className={cx(
            'relative z-10 flex items-start justify-between gap-2 border-b border-white/10 py-5',
            collapsed ? 'px-2' : 'px-4',
          )}
        >
          <div
            className={cx(
              'min-w-0 border-orangy',
              collapsed ? 'border-l-3 pl-2' : 'border-l-6 pl-3.5',
            )}
          >
            {!collapsed && (
              <span className="ku-eyebrow block text-orangy">Kiran Udyog</span>
            )}
            <span
              className={cx(
                'block font-display font-bold leading-none tracking-wide text-white ku-xwide',
                collapsed ? 'text-lead' : 'mt-1.5 text-h2',
              )}
            >
              RTS
            </span>
            {!collapsed && (
              <span className="mt-1.5 block truncate text-caption leading-4 text-dark-white/60">
                Receipt &amp; reimbursement tracking
              </span>
            )}
          </div>
          <IconButton
            icon={X}
            label="Close navigation"
            variant="ghost"
            size="sm"
            onClick={onMobileClose}
            className="-mr-1 shrink-0 !text-dark-white hover:!bg-navy-700 hover:!text-white lg:hidden"
          />
        </div>

        {/* Grouped navigation — one ruled section per team, Accounts owning its
            disbursement surfaces as indented children. */}
        <nav className="ku-scrollbar relative z-10 flex-1 overflow-y-auto py-3">
          {NAV_SECTIONS.map((section, index) => (
            <div
              key={section.label ?? `section-${index}`}
              className={index > 0 ? 'mt-3 border-t border-white/10 pt-3' : ''}
            >
              {section.label &&
                (collapsed ? (
                  // Collapsed the rule above already divides the sections; keep the
                  // label itself for assistive technology.
                  <h2 className="sr-only">{section.label}</h2>
                ) : (
                  <div className="flex items-center gap-3 px-4 pb-2">
                    <h2 className="ku-eyebrow text-dark-white/70">{section.label}</h2>
                    <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
                  </div>
                ))}

              <ul className="flex flex-col">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <SidebarLink item={item} collapsed={collapsed} />

                    {item.children && item.children.length > 0 && (
                      <ul className="flex flex-col">
                        {item.children.map((child) => (
                          <li key={child.to}>
                            <SidebarLink item={child} collapsed={collapsed} nested />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse control + demo disclaimer */}
        <div
          className={cx(
            'relative z-10 flex items-center border-t border-white/10 py-3',
            collapsed ? 'justify-center px-2' : 'justify-between gap-2 px-4',
          )}
        >
          {!collapsed && (
            <span className="ku-eyebrow text-dark-white/60">Demo build · nothing is saved</span>
          )}
          <IconButton
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="shrink-0 !text-dark-white hover:!bg-navy-700 hover:!text-white"
          />
        </div>
      </aside>
    </>
  );
}

function SidebarLink({
  item,
  collapsed,
  nested = false,
}: {
  item: NavItem;
  collapsed: boolean;
  nested?: boolean;
}): JSX.Element {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cx(
          'relative flex items-center border-l-3 transition-colors duration-150',
          nested ? 'py-2 text-caption' : 'py-2.5 text-body-s',
          collapsed ? 'justify-center px-0' : nested ? 'gap-2.5 pl-9 pr-4' : 'gap-3 px-4',
          isActive
            ? // Carved in: a darker well than the rail itself, closed by the orange rule.
              'border-orangy bg-rich-black font-semibold text-white'
            : 'border-transparent text-dark-white/80 hover:bg-navy-700 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* A hairline spine ties children back to their parent. */}
          {nested && !collapsed && (
            <span aria-hidden="true" className="absolute left-6 top-0 h-full w-px bg-white/15" />
          )}
          <span className="relative flex shrink-0 items-center">
            <Icon
              size={nested ? 15 : 18}
              strokeWidth={1.75}
              aria-hidden="true"
              className={isActive ? 'text-orangy' : undefined}
            />
          </span>
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}
