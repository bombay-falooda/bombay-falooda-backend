import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@app/database';

@Injectable()
export class FranchisesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.FranchiseCreateInput) {
    return this.prisma.franchise.create({
      data,
      select: this.defaultSelect(),
    });
  }

  findMany() {
    return this.prisma.franchise.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.defaultSelect(),
    });
  }

  findById(id: string) {
    return this.prisma.franchise.findUnique({
      where: { id },
      select: this.defaultSelect(),
    });
  }

  update(id: string, data: Prisma.FranchiseUpdateInput) {
    return this.prisma.franchise.update({
      where: { id },
      data,
      select: this.defaultSelect(),
    });
  }

  updateStatus(id: string, isActive: boolean) {
    return this.prisma.franchise.update({
      where: { id },
      data: { isActive },
      select: this.defaultSelect(),
    });
  }

  private defaultSelect() {
    return {
      id: true,
      name: true,
      ownerName: true,
      phone: true,
      email: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      agreementStartDate: true,
      agreementEndDate: true,
      gstNumber: true,
      securityDeposit: true,
      royaltyPercent: true,
      notes: true,
      canManageMenu: true,
      canManageOutletStaff: true,
      canViewReports: true,
      canRouteOrders: true,
      canRequestExtraPos: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          outlets: true,
          users: true,
        },
      },
    } satisfies Prisma.FranchiseSelect;
  }
}
