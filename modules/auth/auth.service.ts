import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

import { PrismaService } from '@app/database';

import { UsersService } from '../users/users.service';
import { WhatsappService } from '@app/whatsapp';
import { LoginDto } from './dto/login.dto';
import { EnableAuthenticatorDto } from './dto/enable-authenticator.dto';
import { RequestLoginOtpDto } from './dto/request-login-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';
import { Verify2FaDto } from './dto/verify-2fa.dto';

type AuthUser = NonNullable<
  Awaited<ReturnType<UsersService['findAuthUserByEmailOrPhone']>>
>;

type AccessPayload = {
  sub: string;
  sid: string;
  role: UserRole;
};

type TwoFactorPayload = {
  sub: string;
  otpId?: string;
  purpose: 'LOGIN_2FA';
  method: 'OTP' | 'AUTH_APP';
};

type LoginOtpPayload = {
  sub: string;
  otpId: string;
  purpose: 'PHONE_LOGIN';
};

@Injectable()
export class AuthService {
  private readonly passwordSaltRounds = 12;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findAuthUserByEmailOrPhone(
      dto.emailOrPhone,
    );

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.hasAuthenticatorEnabled(user)) {
      return this.createAuthenticatorChallenge(user);
    }

    return this.issueSession(user);
  }

  async googleAuth(dto: {
    credential?: string;
    email?: string;
    name?: string;
    portal?: 'superadmin' | 'franchise' | 'pos';
  }) {
    let userEmail = dto.email;
    let userName = dto.name;

    if (dto.credential) {
      try {
        const parts = dto.credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf-8'),
          );
          if (payload.email) userEmail = payload.email;
          if (payload.name) userName = payload.name;
        }
      } catch {}
    }

    let user: AuthUser | null = null;

    if (userEmail) {
      user = await this.prisma.user.findFirst({
        where: {
          email: { equals: userEmail, mode: 'insensitive' },
          status: UserStatus.ACTIVE,
        },
      });
    }

    if (!user) {
      if (dto.portal === 'superadmin') {
        user = await this.prisma.user.findFirst({
          where: {
            role: UserRole.SUPERADMIN,
            status: UserStatus.ACTIVE,
          },
        });
      } else if (dto.portal === 'franchise') {
        user = await this.prisma.user.findFirst({
          where: {
            role: UserRole.FRANCHISE_OWNER,
            status: UserStatus.ACTIVE,
          },
        });
      }
    }

    if (!user) {
      throw new UnauthorizedException(
        `No authorized active account found for Google email ${userEmail || ''}`,
      );
    }

    return this.issueSession(user);
  }

  async requestLoginOtp(dto: RequestLoginOtpDto) {
    const phoneCandidates = this.phoneCandidates(dto.phone);
    const user = await this.prisma.user.findFirst({
      where: {
        phone: { in: phoneCandidates },
      },
    });

    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !this.isPhoneOtpLoginRole(user.role)
    ) {
      throw new UnauthorizedException('Invalid phone number');
    }

    if (this.hasAuthenticatorEnabled(user)) {
      return this.createAuthenticatorChallenge(user);
    }

    const otp = randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(otp, this.passwordSaltRounds);
    const authOtp = await this.prisma.authOtp.create({
      data: {
        userId: user.id,
        codeHash,
        purpose: OtpPurpose.PHONE_LOGIN,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    const loginOtpToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        otpId: authOtp.id,
        purpose: 'PHONE_LOGIN',
      } satisfies LoginOtpPayload,
      {
        secret: this.twoFactorSecret,
        expiresIn: '5m',
      },
    );

    // Send WhatsApp OTP in background
    void this.whatsappService.sendLoginOtp(user.phone || dto.phone, otp, user.name);

    return {
      status: 'PHONE_OTP_SENT',
      loginOtpToken,
      expiresInSeconds: 300,
      devOtp: otp,
    };
  }

  async verifyLoginOtp(dto: VerifyLoginOtpDto) {
    const payload = await this.verifyLoginOtpToken(dto.loginOtpToken);
    const otp = await this.prisma.authOtp.findUnique({
      where: { id: payload.otpId },
      include: { user: true },
    });

    if (!otp || otp.userId !== payload.sub || otp.purpose !== OtpPurpose.PHONE_LOGIN) {
      throw new UnauthorizedException('Invalid OTP');
    }

    this.assertOtpCanBeUsed(otp);

    const otpMatches = await bcrypt.compare(dto.otp, otp.codeHash);

    if (!otpMatches) {
      await this.prisma.authOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.authOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    if (this.hasAuthenticatorEnabled(otp.user)) {
      return this.createAuthenticatorChallenge(otp.user);
    }

    return this.issueSession(otp.user);
  }

  async verify2Fa(dto: Verify2FaDto) {
    const payload = await this.verifyTwoFactorToken(dto.twoFactorToken);

    if (payload.method === 'AUTH_APP') {
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

      if (!user || !this.hasAuthenticatorEnabled(user)) {
        throw new UnauthorizedException('Authenticator is not enabled');
      }

      const codeMatches = authenticator.check(dto.otp, user.twoFactorSecret!);

      if (!codeMatches) {
        throw new UnauthorizedException('Invalid authenticator code');
      }

      return this.issueSession(user);
    }

    if (!payload.otpId) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const otp = await this.prisma.authOtp.findUnique({
      where: { id: payload.otpId },
      include: { user: true },
    });

    if (!otp || otp.userId !== payload.sub || otp.purpose !== OtpPurpose.LOGIN_2FA) {
      throw new UnauthorizedException('Invalid OTP');
    }

    this.assertOtpCanBeUsed(otp);

    const otpMatches = await bcrypt.compare(dto.otp, otp.codeHash);

    if (!otpMatches) {
      await this.prisma.authOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.authOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    return this.issueSession(otp.user);
  }

  async setupAuthenticator(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!this.isPhoneOtpLoginRole(user.role)) {
      throw new BadRequestException('Authenticator setup is only for admin users');
    }

    const secret = authenticator.generateSecret();
    const label = `${user.name} ${user.phone || user.email || user.id}`;
    const otpauthUrl = authenticator.keyuri(label, this.authenticatorIssuer, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      issuer: this.authenticatorIssuer,
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  async enableAuthenticator(userId: string, dto: EnableAuthenticatorDto) {
    const codeMatches = authenticator.check(dto.code, dto.secret);

    if (!codeMatches) {
      throw new UnauthorizedException('Invalid authenticator code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: dto.secret,
        twoFactorMethod: 'AUTH_APP',
      },
    });

    return { success: true };
  }

  async disableAuthenticator(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorMethod: null,
      },
    });

    return { success: true, message: 'Two-factor authentication disabled' };
  }

  async refresh(dto: RefreshTokenDto) {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    for (const session of sessions) {
      const matches = await bcrypt.compare(
        dto.refreshToken,
        session.refreshTokenHash,
      );

      if (matches && session.user.status === UserStatus.ACTIVE) {
        const accessToken = await this.signAccessToken(session.user, session.id);

        return {
          accessToken,
          user: this.toPublicUser(session.user),
        };
      }
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  async logout(sessionId: string | undefined) {
    if (!sessionId) {
      throw new BadRequestException('Session id missing');
    }

    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async getMe(userId: string) {
    return this.usersService.findByIdOrFail(userId);
  }

  private hasAuthenticatorEnabled(
    user: Pick<
      AuthUser,
      'twoFactorEnabled' | 'twoFactorSecret' | 'twoFactorMethod'
    >,
  ) {
    return Boolean(
      user.twoFactorEnabled &&
        user.twoFactorSecret &&
        user.twoFactorMethod === 'AUTH_APP',
    );
  }

  private isPhoneOtpLoginRole(role: UserRole) {
    return role === UserRole.SUPERADMIN || role === UserRole.FRANCHISE_OWNER;
  }

  private async createTwoFactorChallenge(user: AuthUser) {
    const otp = randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(otp, this.passwordSaltRounds);
    const authOtp = await this.prisma.authOtp.create({
      data: {
        userId: user.id,
        codeHash,
        purpose: OtpPurpose.LOGIN_2FA,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    const twoFactorToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        otpId: authOtp.id,
        purpose: 'LOGIN_2FA',
        method: 'OTP',
      } satisfies TwoFactorPayload,
      {
        secret: this.twoFactorSecret,
        expiresIn: '5m',
      },
    );

    return {
      status: '2FA_REQUIRED',
      twoFactorToken,
      expiresInSeconds: 300,
      devOtp: otp,
    };
  }

  private async createAuthenticatorChallenge(user: AuthUser) {
    const twoFactorToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        purpose: 'LOGIN_2FA',
        method: 'AUTH_APP',
      } satisfies TwoFactorPayload,
      {
        secret: this.twoFactorSecret,
        expiresIn: '5m',
      },
    );

    return {
      status: '2FA_REQUIRED',
      method: 'AUTH_APP',
      twoFactorToken,
      expiresInSeconds: 300,
    };
  }

  private async issueSession(user: AuthUser) {
    const refreshToken = this.createRefreshToken();
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      this.passwordSaltRounds,
    );
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await this.usersService.updateLastLogin(user.id);

    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken,
      user: this.toPublicUser(user),
    };
  }

  private signAccessToken(user: AuthUser, sessionId: string) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        sid: sessionId,
        role: user.role,
      } satisfies AccessPayload,
      {
        secret: this.accessSecret,
        expiresIn: '15m',
      },
    );
  }

  private async verifyTwoFactorToken(token: string) {
    try {
      return await this.jwtService.verifyAsync<TwoFactorPayload>(token, {
        secret: this.twoFactorSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid 2FA token');
    }
  }

  private async verifyLoginOtpToken(token: string) {
    try {
      return await this.jwtService.verifyAsync<LoginOtpPayload>(token, {
        secret: this.twoFactorSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid login OTP token');
    }
  }

  private assertOtpCanBeUsed(otp: {
    consumedAt: Date | null;
    expiresAt: Date;
    attempts: number;
  }) {
    if (otp.consumedAt) {
      throw new UnauthorizedException('OTP already used');
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('OTP expired');
    }

    if (otp.attempts >= 5) {
      throw new UnauthorizedException('Too many OTP attempts');
    }
  }

  private createRefreshToken() {
    return randomBytes(48).toString('hex');
  }

  private phoneCandidates(phone: string) {
    const trimmed = phone.trim().replace(/\s+/g, '');
    const digits = trimmed.replace(/[^\d]/g, '');
    const candidates = new Set<string>([trimmed, digits]);

    if (digits.length === 10) {
      candidates.add(`+91${digits}`);
    }

    if (digits.length === 12 && digits.startsWith('91')) {
      candidates.add(digits.slice(2));
      candidates.add(`+${digits}`);
    }

    return [...candidates].filter(Boolean);
  }

  private toPublicUser(user: AuthUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      franchiseId: user.franchiseId,
      outletId: user.outletId,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
    };
  }

  private get accessSecret() {
    return this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'dev_access_secret_change_me',
    );
  }

  private get twoFactorSecret() {
    return this.configService.get<string>(
      'JWT_2FA_SECRET',
      this.accessSecret,
    );
  }

  private get authenticatorIssuer() {
    return this.configService.get<string>(
      'AUTHENTICATOR_ISSUER',
      'Bombay Falooda',
    );
  }
}
