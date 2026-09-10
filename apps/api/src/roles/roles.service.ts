import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import type { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOneOrThrow(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(dto: CreateRoleDto, actorId: string) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Role name already in use');

    // New roles start with zero permissions by default (Article III: least privilege).
    const role = await this.prisma.role.create({ data: { name: dto.name, isSystemRole: false } });

    await this.auditService.record({
      actorId,
      action: 'role.created',
      entityType: 'Role',
      entityId: role.id,
      diff: { after: role },
    });

    return this.findOneOrThrow(role.id);
  }

  async rename(id: string, dto: UpdateRoleDto, actorId: string) {
    const before = await this.findOneOrThrow(id);
    const role = await this.prisma.role.update({ where: { id }, data: { name: dto.name } });

    await this.auditService.record({
      actorId,
      action: 'role.renamed',
      entityType: 'Role',
      entityId: role.id,
      diff: { before: { name: before.name }, after: { name: role.name } },
    });

    return this.findOneOrThrow(role.id);
  }

  async delete(id: string, actorId: string) {
    const role = await this.findOneOrThrow(id);
    if (role.isSystemRole) {
      throw new BadRequestException('System roles cannot be deleted');
    }
    await this.prisma.role.delete({ where: { id } });

    await this.auditService.record({
      actorId,
      action: 'role.deleted',
      entityType: 'Role',
      entityId: id,
      diff: { before: role },
    });

    return { success: true };
  }

  async replacePermissions(id: string, dto: UpdateRolePermissionsDto, actorId: string) {
    const before = await this.findOneOrThrow(id);

    // Predefined roles are permission-locked (Ref G3.4, Article III): shipped, undeletable,
    // and their permission set cannot be edited. It is a lockout guard — an admin who can
    // rewrite the built-in roles can remove their own access, or everyone's. Membership
    // stays editable; this endpoint does not touch membership.
    if (before.isSystemRole) {
      throw new BadRequestException(
        `"${before.name}" is a predefined role and is permission-locked. ` +
          `Duplicate it to create an editable custom role.`,
      );
    }

    const keys = dto.permissions.map((p) => p.key);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      // Two grants of one key would silently collapse to whichever the database wrote last,
      // so the scope actually applied would depend on ordering.
      throw new BadRequestException(
        `Duplicate permission keys: ${[...new Set(duplicates)].join(', ')}`,
      );
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: keys }, deprecatedAt: null },
      select: { id: true, key: true },
    });
    if (permissions.length !== keys.length) {
      const found = new Set(permissions.map((p) => p.key));
      const unknown = keys.filter((k) => !found.has(k));
      // Deprecated permissions land here too, which is intended: a key the manifest has
      // retired must not become newly grantable.
      throw new BadRequestException(`Unknown or deprecated permission keys: ${unknown.join(', ')}`);
    }
    const idByKey = new Map(permissions.map((p) => [p.key, p.id]));

    const needsCustomScope = dto.permissions.filter(
      (p) => p.scope === 'custom' && !p.customScopeId,
    );
    if (needsCustomScope.length > 0) {
      throw new BadRequestException(
        `scope "custom" requires a customScopeId: ${needsCustomScope.map((p) => p.key).join(', ')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: dto.permissions.map((p) => ({
          roleId: id,
          permissionId: idByKey.get(p.key)!,
          scope: p.scope,
          scopeDepth: p.scopeDepth ?? null,
          customScopeId: p.customScopeId ?? null,
        })),
      }),
    ]);

    const after = await this.findOneOrThrow(id);

    await this.auditService.record({
      actorId,
      action: 'role.permissions.updated',
      entityType: 'Role',
      entityId: id,
      diff: {
        // Scope is recorded, not just the key. Widening `request.view` from `own` to `all`
        // changes what the role can reach without changing which keys it holds, so a diff of
        // keys alone would show that as no change at all.
        before: before.permissions.map((rp) => `${rp.permission.key}:${rp.scope}`),
        after: after.permissions.map((rp) => `${rp.permission.key}:${rp.scope}`),
      },
    });

    return after;
  }
}
