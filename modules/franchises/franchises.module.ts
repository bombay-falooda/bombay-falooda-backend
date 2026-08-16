import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FranchisesController } from './franchises.controller';
import { FranchisesRepository } from './franchises.repository';
import { FranchisesService } from './franchises.service';

@Module({
  imports: [AuditModule],
  controllers: [FranchisesController],
  providers: [FranchisesRepository, FranchisesService, RolesGuard],
  exports: [FranchisesService],
})
export class FranchisesModule {}
