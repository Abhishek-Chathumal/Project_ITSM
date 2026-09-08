import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@itsm/shared';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { OrgSettingsService } from './org-settings.service';
import { UpsertOrgSettingDto } from './dto/upsert-org-setting.dto';

@ApiTags('org-settings')
@Controller('org-settings')
@RequirePermission(PERMISSIONS.ORG_SETTINGS_MANAGE)
export class OrgSettingsController {
  constructor(private readonly orgSettingsService: OrgSettingsService) {}

  @Get()
  findAll() {
    return this.orgSettingsService.findAll();
  }

  @Put(':key')
  upsert(
    @Param('key') key: string,
    @Body() dto: UpsertOrgSettingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.orgSettingsService.upsert(key, dto.value, actor.id);
  }
}
