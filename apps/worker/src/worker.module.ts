import { Module } from '@nestjs/common';

import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { KotPurgeService } from './kot-purge.service';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  providers: [KotPurgeService],
})
export class WorkerModule {}
