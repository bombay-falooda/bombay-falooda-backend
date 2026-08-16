import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { FranchisePortalController } from './franchise-portal.controller';
import { FranchisePortalService } from './franchise-portal.service';

@Module({
  imports: [AuditModule],
  controllers: [FranchisePortalController],
  providers: [FranchisePortalService],
})
export class FranchisePortalModule {}
