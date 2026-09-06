import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtUser, Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAssignmentDto } from './dto/update-user-assignment.dto';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { MarkAttendanceDto, UpdateSalaryDto } from './dto/staff-payroll.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.Superadmin, UserRole.FranchiseOwner)
  findMany() {
    return this.usersService.findMany();
  }

  @Get('salary-reminders')
  @Roles(UserRole.Superadmin)
  getSalaryReminders() {
    return this.usersService.getSalaryReminders();
  }

  @Get('payroll-summary')
  @Roles(UserRole.Superadmin, UserRole.FranchiseOwner)
  getPayrollSummary(@Query('franchiseId') franchiseId?: string) {
    return this.usersService.getPayrollSummary(franchiseId);
  }

  @Get(':id')
  @Roles(UserRole.Superadmin, UserRole.FranchiseOwner)
  findById(@Param('id') id: string) {
    return this.usersService.findByIdOrFail(id);
  }

  @Get(':id/payroll')
  @Roles(UserRole.Superadmin, UserRole.FranchiseOwner)
  getStaffPayrollDetails(@Param('id') id: string) {
    return this.usersService.getStaffPayrollDetails(id);
  }

  @Post()
  @Roles(UserRole.Superadmin, UserRole.FranchiseOwner)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtUser) {
    return this.usersService.create(dto, user.id);
  }

  @Patch(':id/salary')
  @Roles(UserRole.Superadmin)
  updateSalary(
    @Param('id') id: string,
    @Body() dto: UpdateSalaryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateSalaryDetails(id, dto, user.id);
  }

  @Post(':id/attendance')
  @Roles(UserRole.Superadmin, UserRole.FranchiseOwner)
  markAttendance(
    @Param('id') id: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.markAttendance(id, dto, user.id);
  }

  @Delete(':id/attendance/:date')
  @Roles(UserRole.Superadmin, UserRole.FranchiseOwner)
  removeAttendance(
    @Param('id') id: string,
    @Param('date') date: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.removeAttendance(id, date, user.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.Superadmin)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateStatus(id, dto.status, user.id);
  }

  @Patch(':id/assignment')
  @Roles(UserRole.Superadmin)
  updateAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateUserAssignmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateAssignment(id, dto, user.id);
  }

  @Get(':id/permissions')
  @Roles(UserRole.Superadmin)
  findPermissions(@Param('id') id: string) {
    return this.usersService.findPermissions(id);
  }

  @Post(':id/permissions')
  @Roles(UserRole.Superadmin)
  createPermission(
    @Param('id') id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.createPermission(id, dto, user.id);
  }

  @Patch(':id/permissions')
  @Roles(UserRole.Superadmin)
  updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.createPermission(id, dto, user.id);
  }
}

