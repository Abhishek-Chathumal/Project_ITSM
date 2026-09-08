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

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: dto.permissionKeys } },
    });
    if (permissions.length !== dto.permissionKeys.length) {
      throw new BadRequestException('One or more permission keys are unknown');
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
      }),
    ]);

    const after = await this.findOneOrThrow(id);

    await this.auditService.record({
      actorId,
      action: 'role.permissions.updated',
      entityType: 'Role',
      entityId: id,
      diff: {
        before: before.permissions.map((rp) => rp.permission.key),
        after: after.permissions.map((rp) => rp.permission.key),
      },
    });

    return after;
  }
}
