import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtUser, Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAssignmentDto } from './dto/update-user-assignment.dto';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Superadmin)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findMany() {
    return this.usersService.findMany();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.usersService.findByIdOrFail(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtUser) {
    return this.usersService.create(dto, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateStatus(id, dto.status, user.id);
  }

  @Patch(':id/assignment')
  updateAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateUserAssignmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateAssignment(id, dto, user.id);
  }

  @Get(':id/permissions')
  findPermissions(@Param('id') id: string) {
    return this.usersService.findPermissions(id);
  }

  @Post(':id/permissions')
  createPermission(
    @Param('id') id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.createPermission(id, dto, user.id);
  }

  @Patch(':id/permissions')
  updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.createPermission(id, dto, user.id);
  }
}
