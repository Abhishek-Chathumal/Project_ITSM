import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@itsm/shared';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ROLE_VIEW)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ROLE_VIEW)
  findOne(@Param('id') id: string) {
    return this.rolesService.findOneOrThrow(id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ROLE_CREATE)
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rolesService.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.ROLE_EDIT)
  rename(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.rename(id, dto, actor.id);
  }

  @Patch(':id/permissions')
  @RequirePermission(PERMISSIONS.ROLE_EDIT)
  replacePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.replacePermissions(id, dto, actor.id);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.ROLE_DELETE)
  delete(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.rolesService.delete(id, actor.id);
  }
}
