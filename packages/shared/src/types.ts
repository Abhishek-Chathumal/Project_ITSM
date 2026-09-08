/**
 * Cross-cutting DTO/response shapes shared by the API and web client (Article V:
 * single data model, multiple surfaces). Hand-written for Phase 0; a later phase may
 * generate these from the OpenAPI schema instead — this file is the seam that would
 * plug into.
 */

export type UserStatus = 'active' | 'disabled';

export interface RoleDto {
  id: string;
  name: string;
  isSystemRole: boolean;
}

export interface DepartmentDto {
  id: string;
  name: string;
  parentDepartmentId: string | null;
}

export interface PermissionDto {
  id: string;
  key: string;
  description: string;
}

export interface SessionUserDto {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  role: RoleDto;
  department: DepartmentDto | null;
  permissions: string[];
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roleId: string;
  departmentId: string | null;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  diff: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  requestId?: string;
}
