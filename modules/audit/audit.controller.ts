import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Superadmin)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findMany(@Query() filters: ListAuditLogsDto) {
    return this.auditService.findMany(filters);
  }
}
