import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'disabled';
  roleId: string;
  roleName: string;
  departmentId: string | null;
  permissions: string[];
}

/**
 * Authentication gate: is there a valid session with a live, active user behind it?
 * Registered globally (APP_GUARD) so every route requires a session by default —
 * fail closed. Routes opt out via @Public() (e.g. /auth/login, /health).
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.session?.userId;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roleId: user.roleId,
      roleName: user.role.name,
      departmentId: user.departmentId,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
    };
    request.currentUser = authenticatedUser;
    return true;
  }
}
