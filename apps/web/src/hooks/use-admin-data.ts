import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS } from '@itsm/shared';
import type { AuditLogDto, PermissionDto, RoleDto, UserDto } from '@itsm/shared';
import { apiFetch } from '../lib/api-client';
import { useAuth } from './use-auth';

/**
 * Read hooks for the Phase 0 admin collections.
 *
 * Each is gated on the caller actually holding the permission, so a Requester's
 * dashboard never fires a request that can only come back 403. This is a UX decision,
 * not a security one — `PermissionGuard` is what actually protects these routes, and it
 * runs whether or not the client bothered to ask.
 */
export function useUsers() {
  const { isAllowed } = useAuth();
  return useQuery<UserDto[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserDto[]>('/users'),
    enabled: isAllowed(PERMISSIONS.USER_MANAGE),
  });
}

export function useRoles() {
  const { isAllowed } = useAuth();
  return useQuery<RoleDto[]>({
    queryKey: ['roles'],
    queryFn: () => apiFetch<RoleDto[]>('/roles'),
    enabled: isAllowed(PERMISSIONS.ROLE_MANAGE),
  });
}

export function usePermissionCatalog() {
  const { isAllowed } = useAuth();
  return useQuery<PermissionDto[]>({
    queryKey: ['permissions'],
    queryFn: () => apiFetch<PermissionDto[]>('/permissions'),
    enabled: isAllowed(PERMISSIONS.PERMISSION_VIEW),
  });
}

export function useAuditLogs() {
  const { isAllowed } = useAuth();
  return useQuery<AuditLogDto[]>({
    queryKey: ['audit-logs'],
    queryFn: () => apiFetch<AuditLogDto[]>('/audit-logs'),
    enabled: isAllowed(PERMISSIONS.AUDIT_VIEW),
  });
}
