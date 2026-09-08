import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateDepartmentDto } from './dto/create-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  async findOneOrThrow(id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(dto: CreateDepartmentDto, actorId: string) {
    const dept = await this.prisma.department.create({ data: dto });
    await this.auditService.record({
      actorId,
      action: 'department.created',
      entityType: 'Department',
      entityId: dept.id,
      diff: { after: dept },
    });
    return dept;
  }
}
