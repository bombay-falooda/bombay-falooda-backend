import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, JwtUser } from '@app/common';

import { AuthService } from './auth.service';
import { EnableAuthenticatorDto } from './dto/enable-authenticator.dto';
import { LoginDto } from './dto/login.dto';
import { RequestLoginOtpDto } from './dto/request-login-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';
import { Verify2FaDto } from './dto/verify-2fa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('request-login-otp')
  requestLoginOtp(@Body() dto: RequestLoginOtpDto) {
    return this.authService.requestLoginOtp(dto);
  }

  @Post('verify-login-otp')
  verifyLoginOtp(@Body() dto: VerifyLoginOtpDto) {
    return this.authService.verifyLoginOtp(dto);
  }

  @Post('verify-2fa')
  verify2Fa(@Body() dto: Verify2FaDto) {
    return this.authService.verify2Fa(dto);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  setupAuthenticator(@CurrentUser() user: JwtUser) {
    return this.authService.setupAuthenticator(user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  enableAuthenticator(
    @CurrentUser() user: JwtUser,
    @Body() dto: EnableAuthenticatorDto,
  ) {
    return this.authService.enableAuthenticator(user.id, dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: JwtUser) {
    return this.authService.getMe(user.id);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: JwtUser) {
    return this.authService.logout(user.sessionId);
  }
}
