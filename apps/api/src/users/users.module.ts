import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ReportingTreeService } from './reporting-tree.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [UsersService, ReportingTreeService],
  exports: [ReportingTreeService],
})
export class UsersModule {}
