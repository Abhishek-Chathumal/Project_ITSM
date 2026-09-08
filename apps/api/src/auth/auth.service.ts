import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { SessionUserDto } from '@itsm/shared';
import { PrismaService } from '../prisma/prisma.service';

const SESSION_USER_INCLUDE = {
  role: { include: { permissions: { include: { permission: true } } } },
  department: true,
} as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: SESSION_USER_INCLUDE,
    });

    if (!user || !user.passwordHash || user.status !== 'active') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  /**
   * Fetches the same shape validateCredentials()/toSessionUserDto() produce, by id
   * rather than by credentials — used by GET /auth/me so every endpoint that hands
   * the client "who is logged in" agrees on one DTO shape (Article V).
   */
  async getSessionUserDto(userId: string): Promise<SessionUserDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: SESSION_USER_INCLUDE,
    });
    return this.toSessionUserDto(user);
  }

  toSessionUserDto(user: Awaited<ReturnType<AuthService['validateCredentials']>>): SessionUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      role: { id: user.role.id, name: user.role.name, isSystemRole: user.role.isSystemRole },
      department: user.department
        ? {
            id: user.department.id,
            name: user.department.name,
            parentDepartmentId: user.department.parentDeptId,
          }
        : null,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
    };
  }
}
