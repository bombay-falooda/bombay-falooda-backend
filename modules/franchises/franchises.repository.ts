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

  async findDetailById(id: string, range = "1m") {
    const franchise = await this.prisma.franchise.findUnique({
      where: { id },
      include: {
        outlets: {
          orderBy: { createdAt: "asc" },
          include: {
            posDevices: {
              orderBy: { createdAt: "asc" },
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
      },
    });

    if (!franchise) {
      return null;
    }

    const outlets = franchise.outlets || [];

    const posDevices = outlets.flatMap((outlet) =>
      (outlet.posDevices || []).map((device) => ({
        ...device,
        outletName: outlet.name,
        outletCode: outlet.code,
      })),
    );

    const outletIds = outlets.map((o) => o.id);
    const sinceDate = this.getSinceDate(range);

    const [bills, liveOrders] = outletIds.length
      ? await Promise.all([
          this.prisma.bill.findMany({
            where: {
              outletId: { in: outletIds },
              status: "FINALIZED",
              createdAt: { gte: sinceDate },
            },
            select: {
              id: true,
              total: true,
              outletId: true,
              posDeviceId: true,
              createdAt: true,
            },
          }),
          this.prisma.order.findMany({
            where: {
              outletId: { in: outletIds },
              createdAt: { gte: sinceDate },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              outletId: true,
              source: true,
              type: true,
              status: true,
              total: true,
              customerName: true,
              createdAt: true,
              outlet: { select: { name: true, code: true } },
            },
          }),
        ])
      : [[], []];

    const totalRevenue = bills.reduce((acc, b) => acc + Number(b.total), 0);
    const avgOrderValue = bills.length ? totalRevenue / bills.length : 0;

    const posBifurcationMap = new Map<string, { posDeviceId: string; posName: string; outletName: string; sales: number; bills: number }>();
    const outletBifurcationMap = new Map<string, { outletId: string; outletName: string; outletCode: string; sales: number; bills: number }>();

    for (const bill of bills) {
      const outlet = outlets.find((o) => o.id === bill.outletId);
      const pos = posDevices.find((p) => p.id === bill.posDeviceId);

      const oKey = bill.outletId;
      const oCurr = outletBifurcationMap.get(oKey) || {
        outletId: oKey,
        outletName: outlet?.name || "Unknown Outlet",
        outletCode: outlet?.code || "N/A",
        sales: 0,
        bills: 0,
      };
      oCurr.sales += Number(bill.total);
      oCurr.bills += 1;
      outletBifurcationMap.set(oKey, oCurr);

      const pKey = bill.posDeviceId || "unassigned";
      const pCurr = posBifurcationMap.get(pKey) || {
        posDeviceId: pKey,
        posName: pos?.name || "Main POS",
        outletName: pos?.outletName || outlet?.name || "N/A",
        sales: 0,
        bills: 0,
      };
      pCurr.sales += Number(bill.total);
      pCurr.bills += 1;
      posBifurcationMap.set(pKey, pCurr);
    }

    return {
      ...franchise,
      posDevices,
      performance: {
        totalOrders: liveOrders.length,
        totalBills: bills.length,
        totalRevenue,
        totalRevenueFormatted: `INR ${totalRevenue.toLocaleString("en-IN")}`,
        avgOrderValue,
        avgOrderValueFormatted: `INR ${Math.round(avgOrderValue).toLocaleString("en-IN")}`,
        activeOutlets: outlets.filter((o) => o.status === "ACTIVE").length,
        totalPosDevices: posDevices.length,
        liveOrders: liveOrders.map((o) => ({
          ...o,
          outletName: o.outlet?.name || "N/A",
          totalFormatted: `INR ${Number(o.total).toLocaleString("en-IN")}`,
        })),
        posBifurcation: Array.from(posBifurcationMap.values()).map((p) => ({
          ...p,
          salesFormatted: `INR ${p.sales.toLocaleString("en-IN")}`,
        })),
        outletBifurcation: Array.from(outletBifurcationMap.values()).map((o) => ({
          ...o,
          salesFormatted: `INR ${o.sales.toLocaleString("en-IN")}`,
        })),
      },
    };
  }

  private getSinceDate(range: string): Date {
    const now = new Date();
    switch (range) {
      case "4h":
        return new Date(now.getTime() - 4 * 60 * 60 * 1000);
      case "8h":
        return new Date(now.getTime() - 8 * 60 * 60 * 1000);
      case "1d":
      case "today": {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return start;
      }
      case "yesterday": {
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        return start;
      }
      case "1w":
      case "week":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "all":
        return new Date(0);
      case "1m":
      case "month":
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
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
