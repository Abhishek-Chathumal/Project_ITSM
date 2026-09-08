import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrgSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.orgSettings.findMany();
  }

  async upsert(key: string, value: unknown, actorId: string) {
    const before = await this.prisma.orgSettings.findUnique({ where: { key } });
    const setting = await this.prisma.orgSettings.upsert({
      where: { key },
      create: { key, value: value as never },
      update: { value: value as never },
    });

    await this.auditService.record({
      actorId,
      action: 'org_settings.updated',
      entityType: 'OrgSettings',
      entityId: key,
      diff: { before: before?.value ?? null, after: setting.value },
    });

    return setting;
  }
}
