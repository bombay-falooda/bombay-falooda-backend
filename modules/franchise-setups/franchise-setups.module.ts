import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FranchiseSetupsController } from './franchise-setups.controller';
import { FranchiseSetupsService } from './franchise-setups.service';

@Module({
  imports: [AuditModule],
  controllers: [FranchiseSetupsController],
  providers: [FranchiseSetupsService, RolesGuard],
})
export class FranchiseSetupsModule {}
