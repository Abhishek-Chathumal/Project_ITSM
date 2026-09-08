import type { ComponentType, SVGProps } from 'react';
import { PERMISSIONS } from '@itsm/shared';
import type { PermissionKey } from '@itsm/shared';
import {
  Catalog,
  ChartBar,
  Gauge,
  Monitor,
  ScrollText,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
} from './icons';

export interface NavItem {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Route path. Omitted for modules that don't exist yet. */
  to?: string;
  /** UX-only gate. The API re-checks every request; a hidden link is not a control. */
  permission?: PermissionKey;
  /** Renders disabled with a "Soon" marker instead of linking anywhere. */
  comingSoon?: boolean;
}

export interface NavSection {
  /** Omitted for the primary group, which needs no heading. */
  title?: string;
  items: NavItem[];
}

/**
 * The navigation model, kept as data rather than JSX so the sidebar renders it uniformly
 * and Phase 1+ adds a module by adding a row here.
 *
 * `comingSoon` entries are deliberately visible: the roadmap is part of what this tool
 * communicates to its users, and a greyed row with a "Soon" tag is more honest than a
 * link that 404s. They are still permission-gated where the eventual module will be, so
 * a Requester never sees an Admin entry at all.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', icon: Gauge, to: '/app' },
      { label: 'Tickets', icon: Ticket, comingSoon: true },
      { label: 'Service Catalog', icon: Catalog, comingSoon: true },
      { label: 'Assets', icon: Monitor, comingSoon: true },
      {
        label: 'Reports',
        icon: ChartBar,
        permission: PERMISSIONS.REPORT_VIEW_ORG,
        comingSoon: true,
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', icon: Users, permission: PERMISSIONS.USER_MANAGE, comingSoon: true },
      {
        label: 'Roles & Permissions',
        icon: ShieldCheck,
        permission: PERMISSIONS.ROLE_MANAGE,
        comingSoon: true,
      },
      {
        label: 'Audit Trail',
        icon: ScrollText,
        permission: PERMISSIONS.AUDIT_VIEW,
        comingSoon: true,
      },
      {
        label: 'Settings',
        icon: Settings,
        permission: PERMISSIONS.ORG_SETTINGS_MANAGE,
        comingSoon: true,
      },
    ],
  },
];
