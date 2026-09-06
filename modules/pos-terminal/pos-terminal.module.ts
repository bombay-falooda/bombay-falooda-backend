import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '@app/database';

import { AuditModule } from '../audit/audit.module';
import { PosAuthModule } from '../pos-auth/pos-auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PosTerminalController } from './pos-terminal.controller';
import { PosTerminalService } from './pos-terminal.service';

@Module({
  imports: [DatabaseModule, AuditModule, JwtModule.register({}), PosAuthModule, NotificationsModule],
  controllers: [PosTerminalController],
  providers: [PosTerminalService],
})
export class PosTerminalModule {}
