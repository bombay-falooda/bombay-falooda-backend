import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtUser, Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePosDeviceDto } from './dto/create-pos-device.dto';
import { UpdatePosDeviceStatusDto } from './dto/update-pos-device-status.dto';
import { UpdatePosDeviceDto } from './dto/update-pos-device.dto';
import { PosService } from './pos.service';

@Controller('pos-devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Superadmin)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post()
  create(@Body() dto: CreatePosDeviceDto, @CurrentUser() user: JwtUser) {
    return this.posService.create(dto, user.id);
  }

  @Get()
  findMany() {
    return this.posService.findMany();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.posService.findByIdOrFail(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePosDeviceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.posService.update(id, dto, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePosDeviceStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.posService.updateStatus(id, dto, user.id);
  }
}
