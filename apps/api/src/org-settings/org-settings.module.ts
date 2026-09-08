import { Module } from '@nestjs/common';
import { OrgSettingsController } from './org-settings.controller';
import { OrgSettingsService } from './org-settings.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [OrgSettingsController],
  providers: [OrgSettingsService],
})
export class OrgSettingsModule {}
