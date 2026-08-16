import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OutletsController } from './outlets.controller';
import { OutletsRepository } from './outlets.repository';
import { OutletsService } from './outlets.service';

@Module({
  imports: [AuditModule],
  controllers: [OutletsController],
  providers: [OutletsRepository, OutletsService, RolesGuard],
  exports: [OutletsService],
})
export class OutletsModule {}
