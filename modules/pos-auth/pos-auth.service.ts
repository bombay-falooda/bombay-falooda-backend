import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OutletStatus, PosDeviceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '@app/database';

import { PosLoginDto } from './dto/pos-login.dto';
import { PosJwtPayload } from './pos-session.type';

@Injectable()
export class PosAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: PosLoginDto) {
    const accessKey = dto.accessKey.trim();
    const device = await this.prisma.posDevice.findUnique({
      where: { accessKey },
      include: {
        outlet: {
          include: {
            franchise: {
              select: { id: true, name: true, isActive: true },
            },
          },
        },
      },
    });

    if (!device?.pinHash) {
      throw new UnauthorizedException('Invalid POS credentials');
    }

    const pinOk = await bcrypt.compare(dto.pin.trim(), device.pinHash);
    if (!pinOk) {
      throw new UnauthorizedException('Invalid POS credentials');
    }

    if (
      device.status !== PosDeviceStatus.ACTIVE ||
      device.outlet.status !== OutletStatus.ACTIVE ||
      device.outlet.franchise?.isActive === false
    ) {
      throw new UnauthorizedException('This POS device is not active');
    }

    const now = new Date();
    if (device.validFrom && device.validFrom > now) {
      throw new UnauthorizedException('Temporary POS is not valid yet');
    }

    if (device.validUntil && device.validUntil < now) {
      await this.prisma.posDevice.update({
        where: { id: device.id },
        data: { status: PosDeviceStatus.EXPIRED },
      });
      throw new UnauthorizedException('Temporary POS has expired');
    }

    await this.prisma.posDevice.update({
      where: { id: device.id },
      data: {
        deviceCode:
          dto.deviceCode && dto.deviceCode !== device.deviceCode
            ? dto.deviceCode
            : undefined,
        lastLoginAt: now,
        lastLoginDeviceCode: dto.deviceCode || device.deviceCode,
      },
    });

    const payload: PosJwtPayload = {
      sessionType: 'POS',
      posDeviceId: device.id,
      outletId: device.outletId,
      franchiseId: device.outlet.franchiseId,
      type: device.type,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload, {
        secret: process.env.JWT_POS_SECRET || process.env.JWT_SECRET || 'dev-pos-secret',
        expiresIn: '12h',
      }),
      posDevice: {
        id: device.id,
        name: device.name,
        type: device.type,
        status: device.status,
        accessKey: device.accessKey,
        eventName: device.eventName,
        eventLocation: device.eventLocation,
        validFrom: device.validFrom,
        validUntil: device.validUntil,
      },
      outlet: {
        id: device.outlet.id,
        name: device.outlet.name,
        code: device.outlet.code,
        address: device.outlet.address,
      },
      franchise: device.outlet.franchise,
    };
  }
}
