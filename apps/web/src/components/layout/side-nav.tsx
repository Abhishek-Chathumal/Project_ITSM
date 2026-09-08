import { NavLink } from 'react-router-dom';
import type { PermissionKey } from '@itsm/shared';
import { cn } from '../../lib/cn';
import { useAuth } from '../../hooks/use-auth';
import { useUiStore } from '../../stores/ui-store';
import { NAV_SECTIONS, type NavItem, type NavSection } from './nav-items';
import { PanelLeft } from './icons';

function itemIsVisible(item: NavItem, isAllowed: (key: PermissionKey) => boolean): boolean {
  return item.permission === undefined || isAllowed(item.permission);
}

interface NavRowProps {
  item: NavItem;
  collapsed: boolean;
  onNavigate: () => void;
}

function NavRow({ item, collapsed, onNavigate }: NavRowProps) {
  const Icon = item.icon;

  const shared = cn(
    'group relative flex items-center rounded-md text-sm transition-colors',
    collapsed ? 'h-9 w-9 justify-center' : 'h-9 gap-3 px-3',
  );
  // In rail mode the label is gone, so the icon needs its own accessible name.
  const label = <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>;

  if (item.comingSoon || !item.to) {
    return (
      <span
        aria-disabled="true"
        title={collapsed ? `${item.label} — coming in a later phase` : 'Coming in a later phase'}
        className={cn(shared, 'cursor-not-allowed text-muted-foreground opacity-60')}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {label}
        {!collapsed && (
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Soon
          </span>
        )}
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      end
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          shared,
          isActive
            ? 'bg-primary font-medium text-primary-foreground'
            : 'text-muted-foreground hover:bg-hover hover:text-foreground',
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {label}
    </NavLink>
  );
}

interface SideNavProps {
  /** Rendered inside the mobile drawer, where the rail-collapse affordance makes no sense. */
  variant?: 'desktop' | 'mobile';
}

export function SideNav({ variant = 'desktop' }: SideNavProps) {
  const { isAllowed } = useAuth();
  const { navCollapsed, toggleNavCollapsed, setMobileNavOpen } = useUiStore();

  const collapsed = variant === 'desktop' && navCollapsed;
  const onNavigate = () => variant === 'mobile' && setMobileNavOpen(false);

  const sections: NavSection[] = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => itemIsVisible(item, isAllowed)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav
      aria-label="Main"
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-sidebar-rail' : 'w-sidebar',
      )}
    >
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section, index) => (
          <div key={section.title ?? 'primary'} className={cn(index > 0 && 'mt-5')}>
            {section.title && !collapsed && (
              <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h2>
            )}
            {section.title && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-border" />}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.label}>
                  <NavRow item={item} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {variant === 'desktop' && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={toggleNavCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-9 items-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground',
              collapsed ? 'w-9 justify-center' : 'w-full gap-3 px-3',
            )}
          >
            <PanelLeft className={cn('h-[18px] w-[18px] shrink-0', collapsed && 'rotate-180')} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </nav>
  );
}
