import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@itsm/shared';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from './session-auth.guard';

/**
 * Authorization gate: does the current user's role hold the required permission key?
 * Runs after SessionAuthGuard (which populates request.currentUser). Entity-agnostic —
 * it only compares string keys, so every future module reuses this unchanged; new
 * capabilities are new seeded Permission rows, not new guard logic (Article II).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.currentUser;
    if (!user || !user.permissions.includes(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }
}
