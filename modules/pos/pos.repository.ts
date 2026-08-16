import { Injectable } from '@nestjs/common';
import { PosDeviceStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@app/database';

@Injectable()
export class PosRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.PosDeviceCreateInput) {
    return this.prisma.posDevice.create({
      data,
      select: this.defaultSelect(),
    });
  }

  findMany() {
    return this.prisma.posDevice.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect(),
    });
  }

  findById(id: string) {
    return this.prisma.posDevice.findUnique({
      where: { id },
      select: this.defaultSelect(),
    });
  }

  findByAccessKey(accessKey: string) {
    return this.prisma.posDevice.findUnique({
      where: { accessKey },
      select: { id: true },
    });
  }

  update(id: string, data: Prisma.PosDeviceUpdateInput) {
    return this.prisma.posDevice.update({
      where: { id },
      data,
      select: this.defaultSelect(),
    });
  }

  updateStatus(id: string, status: PosDeviceStatus) {
    return this.prisma.posDevice.update({
      where: { id },
      data: { status },
      select: this.defaultSelect(),
    });
  }

  private defaultSelect() {
    return {
      id: true,
      outletId: true,
      name: true,
      type: true,
      status: true,
      accessKey: true,
      deviceCode: true,
      eventName: true,
      eventLocation: true,
      handlerName: true,
      handlerPhone: true,
      validFrom: true,
      validUntil: true,
      lastLoginAt: true,
      lastLoginDeviceCode: true,
      createdAt: true,
      updatedAt: true,
      outlet: {
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          status: true,
          franchise: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    } satisfies Prisma.PosDeviceSelect;
  }
}
