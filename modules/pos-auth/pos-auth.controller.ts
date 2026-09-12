import { Body, Controller, Post } from '@nestjs/common';

import { PosLoginDto } from './dto/pos-login.dto';
import { PosAuthService } from './pos-auth.service';

@Controller('pos-auth')
export class PosAuthController {
  constructor(private readonly posAuthService: PosAuthService) {}

  @Post('login')
  login(@Body() dto: PosLoginDto) {
    return this.posAuthService.login(dto);
  }

  @Post('google')
  googleLogin(
    @Body()
    dto: {
      credential?: string;
      email?: string;
      name?: string;
      deviceCode?: string;
    },
  ) {
    return this.posAuthService.googleLogin(dto);
  }
}
