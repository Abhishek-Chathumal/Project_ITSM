import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import type { AuthenticatedUser } from './session-auth.guard';

function makeContext(currentUser?: AuthenticatedUser): ExecutionContext {
  const request = { currentUser };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  const user = (permissions: string[]): AuthenticatedUser => ({
    id: 'u1',
    name: 'Test User',
    email: 't@example.com',
    status: 'active',
    roleId: 'r1',
    roleName: 'Admin',
    departmentId: null,
    permissions,
  });

  it('allows the request when no permission is required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('allows the request when the user holds the required permission', () => {
    const reflector = { getAllAndOverride: () => 'role.manage' } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    expect(guard.canActivate(makeContext(user(['role.manage'])))).toBe(true);
  });

  it('denies the request when the user lacks the required permission', () => {
    const reflector = { getAllAndOverride: () => 'role.manage' } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    expect(() => guard.canActivate(makeContext(user(['audit.view'])))).toThrow(ForbiddenException);
  });

  it('denies the request when there is no authenticated user at all', () => {
    const reflector = { getAllAndOverride: () => 'role.manage' } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
