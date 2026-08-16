import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PosController } from './pos.controller';
import { PosRepository } from './pos.repository';
import { PosService } from './pos.service';

@Module({
  imports: [AuditModule],
  controllers: [PosController],
  providers: [PosRepository, PosService, RolesGuard],
  exports: [PosService],
})
export class PosModule {}
