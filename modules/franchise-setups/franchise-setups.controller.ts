import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtUser, Roles, UserRole } from '@app/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateFranchiseSetupDto } from './dto/create-franchise-setup.dto';
import { FranchiseSetupsService } from './franchise-setups.service';

@Controller('franchise-setups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Superadmin)
export class FranchiseSetupsController {
  constructor(private readonly franchiseSetupsService: FranchiseSetupsService) {}

  @Post()
  create(@Body() dto: CreateFranchiseSetupDto, @CurrentUser() user: JwtUser) {
    return this.franchiseSetupsService.create(dto, user.id);
  }
}
