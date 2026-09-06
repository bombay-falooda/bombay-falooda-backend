import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PosDeviceStatus } from '@prisma/client';

import { CurrentUser, JwtUser, Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateMenuAddonDto } from './dto/create-menu-addon.dto';
import { CreateMenuAddonGroupDto } from './dto/create-menu-addon-group.dto';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { RequestPosDeviceDto } from './dto/request-pos-device.dto';
import { UpdateFranchiseProfileDto } from './dto/update-franchise-profile.dto';
import { UpdateMenuAddonDto } from './dto/update-menu-addon.dto';
import { UpdateMenuAddonGroupDto } from './dto/update-menu-addon-group.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateOutletMenuItemDto } from './dto/update-outlet-menu-item.dto';
import { UpdateOutletSettingsDto } from './dto/update-outlet-settings.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { UpsertOrderRouteDto } from './dto/upsert-order-route.dto';
import { FranchisePortalService } from './franchise-portal.service';

@Controller('franchise-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FranchiseOwner)
export class FranchisePortalController {
  constructor(private readonly franchisePortalService: FranchisePortalService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.dashboard(user.franchiseId);
  }

  @Get('profile')
  profile(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.profile(user.franchiseId);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateFranchiseProfileDto,
  ) {
    return this.franchisePortalService.updateProfile(
      user.franchiseId,
      dto,
      user.id,
    );
  }

  @Get('outlets')
  outlets(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.outlets(user.franchiseId);
  }

  @Patch('outlets/:id')
  updateOutletSettings(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateOutletSettingsDto,
  ) {
    return this.franchisePortalService.updateOutletSettings(
      user.franchiseId,
      id,
      dto,
      user.id,
    );
  }

  @Get('pos-devices')
  posDevices(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.posDevices(user.franchiseId);
  }

  @Get('pos-devices/:id')
  posDeviceDetails(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    return this.franchisePortalService.posDeviceDetails(
      user.franchiseId,
      id,
      range,
    );
  }

  @Post('pos-devices/request')
  requestPosDevice(
    @CurrentUser() user: JwtUser,
    @Body() dto: RequestPosDeviceDto,
  ) {
    return this.franchisePortalService.requestPosDevice(
      user.franchiseId,
      dto,
      user.id,
    );
  }

  @Patch('pos-devices/:id/status')
  updatePosStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body('status') status: PosDeviceStatus,
  ) {
    return this.franchisePortalService.updatePosStatus(
      user.franchiseId,
      id,
      status,
      user.id,
    );
  }

  @Get('team')
  team(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.team(user.franchiseId);
  }

  @Post('team')
  createTeamMember(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateTeamMemberDto,
  ) {
    return this.franchisePortalService.createTeamMember(
      user.franchiseId,
      dto,
      user.id,
    );
  }

  @Patch('team/:id')
  updateTeamMember(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.franchisePortalService.updateTeamMember(
      user.franchiseId,
      id,
      dto,
      user.id,
    );
  }

  @Delete('team/:id')
  deactivateTeamMember(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.franchisePortalService.deactivateTeamMember(
      user.franchiseId,
      id,
      user.id,
    );
  }

  @Get('menu/categories')
  menuCategories() {
    return this.franchisePortalService.menuCategories();
  }

  @Post('menu/categories')
  createMenuCategory(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.franchisePortalService.createMenuCategory(
      user.franchiseId,
      dto,
      user.id,
    );
  }

  @Patch('menu/categories/:id')
  updateMenuCategory(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.franchisePortalService.updateMenuCategory(
      user.franchiseId,
      id,
      dto,
      user.id,
    );
  }

  @Get('menu/items')
  menuItems(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.menuItems(user.franchiseId);
  }

  @Post('menu/items')
  createMenuItem(@CurrentUser() user: JwtUser, @Body() dto: CreateMenuItemDto) {
    return this.franchisePortalService.createMenuItem(
      user.franchiseId,
      dto,
      user.id,
    );
  }

  @Patch('menu/items/:id')
  updateMenuItem(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.franchisePortalService.updateMenuItem(
      user.franchiseId,
      id,
      dto,
      user.id,
    );
  }

  @Post('menu/outlet-items')
  updateOutletMenuItem(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateOutletMenuItemDto,
  ) {
    return this.franchisePortalService.updateOutletMenuItem(
      user.franchiseId,
      dto,
      user.id,
    );
  }

  @Post('menu/addon-groups')
  createMenuAddonGroup(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMenuAddonGroupDto,
  ) {
    return this.franchisePortalService.createMenuAddonGroup(
      user.franchiseId,
      dto,
      user.id,
    );
  }

  @Patch('menu/addon-groups/:id')
  updateMenuAddonGroup(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMenuAddonGroupDto,
  ) {
    return this.franchisePortalService.updateMenuAddonGroup(
      user.franchiseId,
      id,
      dto,
      user.id,
    );
  }

  @Post('menu/addons')
  createMenuAddon(@CurrentUser() user: JwtUser, @Body() dto: CreateMenuAddonDto) {
    return this.franchisePortalService.createMenuAddon(
      user.franchiseId,
      dto,
      user.id,
    );
  }

  @Patch('menu/addons/:id')
  updateMenuAddon(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMenuAddonDto,
  ) {
    return this.franchisePortalService.updateMenuAddon(
      user.franchiseId,
      id,
      dto,
      user.id,
    );
  }

  @Get('order-routes')
  orderRoutes(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.orderRoutes(user.franchiseId);
  }

  @Post('order-routes')
  upsertOrderRoute(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertOrderRouteDto,
  ) {
    return this.franchisePortalService.upsertOrderRoute(
      user.franchiseId,
      dto,
      user.id,
    );
  }

  @Get('reports')
  reports(
    @CurrentUser() user: JwtUser,
    @Query('range') range?: string,
    @Query('outletId') outletId?: string,
    @Query('posDeviceId') posDeviceId?: string,
  ) {
    return this.franchisePortalService.reports(
      user.franchiseId,
      range,
      outletId,
      posDeviceId,
    );
  }

  @Get('alerts')
  alerts(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.alerts(user.franchiseId);
  }

  @Get('audit-logs')
  auditLogs(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.auditLogs(user.franchiseId);
  }

  @Get('permissions')
  permissions(@CurrentUser() user: JwtUser) {
    return this.franchisePortalService.permissions(user.franchiseId);
  }
}
