import { PERMISSIONS } from '@itsm/shared';
import { cn } from '../../lib/cn';
import { useAuth } from '../../hooks/use-auth';
import { useUiStore } from '../../stores/ui-store';

interface NavItem {
  label: string;
  enabled: boolean;
  comingSoon?: boolean;
}

export function SideNav() {
  const { isAllowed } = useAuth();
  const { navCollapsed } = useUiStore();

  const items: NavItem[] = [
    { label: 'Dashboard', enabled: true },
    { label: 'Tickets', enabled: false, comingSoon: true },
    { label: 'Service Catalog', enabled: false, comingSoon: true },
    { label: 'Assets', enabled: false, comingSoon: true },
    { label: 'Reports', enabled: isAllowed(PERMISSIONS.REPORT_VIEW_ORG), comingSoon: true },
    { label: 'Admin', enabled: isAllowed(PERMISSIONS.ROLE_MANAGE), comingSoon: true },
  ];

  return (
    <nav
      className={cn(
        'w-56 shrink-0 border-r border-border bg-card p-2',
        navCollapsed && 'hidden md:block',
      )}
    >
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.label}>
            <button
              disabled={!item.enabled}
              title={item.comingSoon && item.enabled ? 'Coming in a later phase' : undefined}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left text-sm',
                item.enabled
                  ? 'hover:bg-muted'
                  : 'cursor-not-allowed text-muted-foreground opacity-50',
              )}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
