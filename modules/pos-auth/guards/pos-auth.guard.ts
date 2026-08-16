import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PosDeviceStatus, OutletStatus } from '@prisma/client';

import { PrismaService } from '@app/database';

import { PosJwtPayload } from '../pos-session.type';

@Injectable()
export class PosAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      posSession?: PosJwtPayload;
    }>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('POS session token is required');
    }

    let payload: PosJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<PosJwtPayload>(token, {
        secret: process.env.JWT_POS_SECRET || process.env.JWT_SECRET || 'dev-pos-secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid POS session');
    }

    if (payload.sessionType !== 'POS') {
      throw new UnauthorizedException('Invalid POS token type');
    }

    const device = await this.prisma.posDevice.findUnique({
      where: { id: payload.posDeviceId },
      include: { outlet: { select: { id: true, franchiseId: true, status: true } } },
    });

    if (
      !device ||
      device.status !== PosDeviceStatus.ACTIVE ||
      device.outlet.status !== OutletStatus.ACTIVE
    ) {
      throw new UnauthorizedException('POS device is not active');
    }

    const now = new Date();
    if (device.validFrom && device.validFrom > now) {
      throw new UnauthorizedException('Temporary POS is not valid yet');
    }

    if (device.validUntil && device.validUntil < now) {
      throw new UnauthorizedException('Temporary POS has expired');
    }

    request.posSession = {
      sessionType: 'POS',
      posDeviceId: device.id,
      outletId: device.outletId,
      franchiseId: device.outlet.franchiseId,
      type: device.type,
    };

    return true;
  }

  private extractBearerToken(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
