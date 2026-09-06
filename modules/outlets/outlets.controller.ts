import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtUser, Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletStatusDto } from './dto/update-outlet-status.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { CreateOutletMenuItemDto, UpdateOutletMenuItemDto } from './dto/outlet-menu-item.dto';
import { OutletsService } from './outlets.service';

@Controller('outlets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Superadmin)
export class OutletsController {
  constructor(private readonly outletsService: OutletsService) {}

  @Post()
  create(@Body() dto: CreateOutletDto, @CurrentUser() user: JwtUser) {
    return this.outletsService.create(dto, user.id);
  }

  @Get()
  findMany() {
    return this.outletsService.findMany();
  }

  @Get('categories')
  getCategories() {
    return this.outletsService.getMenuCategories();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.outletsService.findByIdOrFail(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOutletDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.outletsService.update(id, dto, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOutletStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.outletsService.updateStatus(id, dto, user.id);
  }

  @Post(':id/items')
  createMenuItem(
    @Param('id') id: string,
    @Body() dto: CreateOutletMenuItemDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.outletsService.createOutletMenuItem(id, dto, user.id);
  }

  @Patch(':id/items/:itemId')
  updateMenuItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOutletMenuItemDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.outletsService.updateOutletMenuItem(id, itemId, dto, user.id);
  }

  @Delete(':id/items/:itemId')
  deleteMenuItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.outletsService.deleteOutletMenuItem(id, itemId, user.id);
  }

  @Post(':id/copy-menu-from/:sourceOutletId')
  copyMenuFrom(
    @Param('id') id: string,
    @Param('sourceOutletId') sourceOutletId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.outletsService.copyMenuFromOutlet(id, sourceOutletId, user.id);
  }
}

