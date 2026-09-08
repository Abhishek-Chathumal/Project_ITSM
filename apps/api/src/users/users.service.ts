import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  status: true,
  roleId: true,
  departmentId: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({ select: SAFE_SELECT, orderBy: { createdAt: 'desc' } });
  }

  async findOneOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        roleId: dto.roleId,
        departmentId: dto.departmentId,
      },
      select: SAFE_SELECT,
    });

    await this.auditService.record({
      actorId,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      diff: { after: user },
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const before = await this.findOneOrThrow(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: SAFE_SELECT,
    });

    await this.auditService.record({
      actorId,
      action: 'user.updated',
      entityType: 'User',
      entityId: user.id,
      diff: { before, after: user },
    });

    return user;
  }
}
