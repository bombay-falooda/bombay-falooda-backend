import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '@app/database';

import { AuditModule } from '../audit/audit.module';
import { PosAuthModule } from '../pos-auth/pos-auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PosTerminalController } from './pos-terminal.controller';
import { OnlineOrdersWebhookController } from './online-orders-webhook.controller';
import { PosTerminalService } from './pos-terminal.service';
import { ZomatoIntegrationService } from './zomato-integration.service';
import { SwiggyIntegrationService } from './swiggy-integration.service';
import { EzcaterIntegrationService } from './ezcater-integration.service';
import { UrbanpiperIntegrationService } from './urbanpiper-integration.service';

@Module({
  imports: [DatabaseModule, AuditModule, JwtModule.register({}), PosAuthModule, NotificationsModule],
  controllers: [PosTerminalController, OnlineOrdersWebhookController],
  providers: [
    PosTerminalService,
    ZomatoIntegrationService,
    SwiggyIntegrationService,
    EzcaterIntegrationService,
    UrbanpiperIntegrationService,
  ],
  exports: [
    PosTerminalService,
    ZomatoIntegrationService,
    SwiggyIntegrationService,
    EzcaterIntegrationService,
    UrbanpiperIntegrationService,
  ],
})
export class PosTerminalModule {}
