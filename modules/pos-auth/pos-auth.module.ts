import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '@app/database';

import { PosAuthController } from './pos-auth.controller';
import { PosAuthGuard } from './guards/pos-auth.guard';
import { PosAuthService } from './pos-auth.service';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [PosAuthController],
  providers: [PosAuthService, PosAuthGuard],
  exports: [PosAuthGuard],
})
export class PosAuthModule {}
