import { Module } from '@nestjs/common';

import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';

import { AuditModule } from '../../../modules/audit/audit.module';
import { AuthModule } from '../../../modules/auth/auth.module';
import { FranchisesModule } from '../../../modules/franchises/franchises.module';
import { FranchisePortalModule } from '../../../modules/franchise-portal/franchise-portal.module';
import { FranchiseSetupsModule } from '../../../modules/franchise-setups/franchise-setups.module';
import { OutletsModule } from '../../../modules/outlets/outlets.module';
import { PosAuthModule } from '../../../modules/pos-auth/pos-auth.module';
import { PosModule } from '../../../modules/pos/pos.module';
import { PosTerminalModule } from '../../../modules/pos-terminal/pos-terminal.module';
import { ReportsModule } from '../../../modules/reports/reports.module';
import { UsersModule } from '../../../modules/users/users.module';
import { WebsiteModule } from '../../../modules/website/website.module';
import { NotificationsModule } from '../../../modules/notifications/notifications.module';
import { DownloadsModule } from '../../../modules/downloads/downloads.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    AuditModule,
    AuthModule,
    UsersModule,
    FranchisesModule,
    FranchisePortalModule,
    FranchiseSetupsModule,
    OutletsModule,
    PosModule,
    PosAuthModule,
    PosTerminalModule,
    ReportsModule,
    WebsiteModule,
    NotificationsModule,
    DownloadsModule,
  ],
})
export class ApiModule {}
