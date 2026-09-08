import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@itsm/shared';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';

@ApiTags('departments')
@Controller('departments')
@RequirePermission(PERMISSIONS.DEPARTMENT_MANAGE)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOneOrThrow(id);
  }

  @Post()
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.departmentsService.create(dto, actor.id);
  }
}
