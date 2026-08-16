import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtUser, Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateFranchiseDto } from './dto/create-franchise.dto';
import { UpdateFranchiseStatusDto } from './dto/update-franchise-status.dto';
import { UpdateFranchiseDto } from './dto/update-franchise.dto';
import { FranchisesService } from './franchises.service';

@Controller('franchises')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Superadmin)
export class FranchisesController {
  constructor(private readonly franchisesService: FranchisesService) {}

  @Post()
  create(@Body() dto: CreateFranchiseDto, @CurrentUser() user: JwtUser) {
    return this.franchisesService.create(dto, user.id);
  }

  @Get()
  findMany() {
    return this.franchisesService.findMany();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.franchisesService.findByIdOrFail(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFranchiseDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.franchisesService.update(id, dto, user.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFranchiseStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.franchisesService.updateStatus(id, dto, user.id);
  }
}
