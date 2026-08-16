import { Module } from '@nestjs/common';

import { DatabaseModule } from '@app/database';

import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WebsiteController],
  providers: [WebsiteService],
})
export class WebsiteModule {}
