import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Superadmin)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('superadmin-dashboard')
  superadminDashboard(
    @Query('range') range = '1d',
    @Query('franchiseId') franchiseId?: string,
    @Query('outletId') outletId?: string,
    @Query('source') source?: string,
    @Query('type') type?: string,
  ) {
    return this.reportsService.superadminDashboard({
      range,
      franchiseId,
      outletId,
      source,
      type,
    });
  }
}
