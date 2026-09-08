import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@itsm/shared';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_VIEW)
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.auditService.list({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }
}
