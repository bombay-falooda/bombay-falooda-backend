import { Module } from '@nestjs/common';

import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [AppConfigModule, DatabaseModule],
})
export class WorkerModule {}
