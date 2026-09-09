/**
 * Single source of truth for permission keys (Article II: Configuration Over Code).
 *
 * These string keys are what the API's PermissionGuard checks against a role's seeded
 * RolePermission rows, and what the frontend uses for UX-only conditional rendering.
 * The API is always the real security boundary — the frontend check is a convenience.
 *
 * Phase 1+ modules add new keys here as they add new seeded Permission rows; the
 * RBAC mechanism itself never changes.
 */
export const PERMISSIONS = {
  ROLE_MANAGE: 'role.manage',
  PERMISSION_VIEW: 'permission.view',
  USER_MANAGE: 'user.manage',
  DEPARTMENT_MANAGE: 'department.manage',
  AUTOMATION_MANAGE: 'automation.manage',
  REPORT_VIEW_ORG: 'report.view.org',
  AUDIT_VIEW: 'audit.view',
  ORG_SETTINGS_MANAGE: 'org_settings.manage',

  // Forward-declared for Phase 1 (ticketing) so the permission catalog doesn't
  // need a migration when that module lands.
  TICKET_VIEW_OWN: 'ticket.view.own',
  TICKET_EDIT_ASSIGNED: 'ticket.edit.assigned',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Default system roles shipped out of the box. Duplicable — never hardcoded into
 * authorization logic, only used to seed initial data.
 *
 * NOTE (ADR-0017): Amendment A-001 expands this to twelve seeded roles (Super Admin, Service
 * Desk Technician, Request Specialist, Problem Specialist, Change Specialist, Team Lead,
 * Change Manager, Knowledge Manager, Dashboard Viewer, Report Viewer, Auditor, Requester) and
 * makes predefined roles **permission-locked** — membership editable, permission set not, so
 * an admin cannot lock everyone out. Still to be applied; see Constitution 5.2. */
export const DEFAULT_ROLES = [
  'Requester',
  'Technician',
  'Team Lead',
  'Change Manager',
  'Admin',
  'Auditor',
] as const;

export type DefaultRoleName = (typeof DEFAULT_ROLES)[number];
