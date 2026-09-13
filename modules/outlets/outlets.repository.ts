import { Injectable } from '@nestjs/common';
import { OutletStatus, Prisma } from '@prisma/client';

import { PrismaService } from '@app/database';

@Injectable()
export class OutletsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.OutletCreateInput) {
    return this.prisma.outlet.create({
      data,
      select: this.defaultSelect(),
    });
  }

  findMany() {
    return this.prisma.outlet.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect(),
    });
  }

  findById(id: string) {
    return this.prisma.outlet.findUnique({
      where: { id },
      include: {
        franchise: true,
        posDevices: {
          orderBy: { createdAt: 'asc' },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        outletMenuItems: {
          include: {
            item: {
              include: {
                category: true,
                addonGroups: {
                  include: {
                    addons: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.outlet.findUnique({
      where: { code },
      select: { id: true },
    });
  }

  update(id: string, data: Prisma.OutletUpdateInput) {
    return this.prisma.outlet.update({
      where: { id },
      data,
      select: this.defaultSelect(),
    });
  }

  updateStatus(id: string, status: OutletStatus) {
    return this.prisma.outlet.update({
      where: { id },
      data: { status },
      select: this.defaultSelect(),
    });
  }

  private defaultSelect(): Prisma.OutletSelect {
    return {
      id: true,
      franchiseId: true,
      name: true,
      code: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      email: true,
      latitude: true,
      longitude: true,
      status: true,
      dineIn: true,
      takeaway: true,
      delivery: true,
      onlineOrderingEnabled: true,
      serviceRadiusKm: true,
      deliveryKmPricing: true,
      openingTime: true,
      closingTime: true,
      zomatoResId: true,
      swiggyResId: true,
      ezcaterStoreId: true,
      urbanpiperStoreId: true,
      menuSetupStatus: true,
      menuEditingLocked: true,
      menuEditingUnlockedUntil: true,
      createdAt: true,
      updatedAt: true,
      franchise: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
      _count: {
        select: {
          posDevices: true,
          users: true,
        },
      },
    };
  }
}
