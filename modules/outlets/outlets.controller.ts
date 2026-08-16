import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtUser, Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletStatusDto } from './dto/update-outlet-status.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
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
}
