import { Injectable } from '@nestjs/common';
import {
  BillStatus,
  OrderSource,
  OrderType,
  OutletStatus,
  PosDeviceStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '@app/database';

type DashboardFilters = {
  range: string;
  franchiseId?: string;
  outletId?: string;
  source?: string;
  type?: string;
};

type BillWithOrder = {
  total: Prisma.Decimal;
  createdAt: Date;
  outletId: string;
  order: { source: OrderSource; type: OrderType } | null;
  outlet: {
    id: string;
    name: string;
    code: string;
    franchise: { id: string; name: string } | null;
  };
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async superadminDashboard(filters: DashboardFilters) {
    const since = await this.dateFromRange(filters.range, filters.outletId);

    const source = this.enumValue(OrderSource, filters.source);
    const type = this.enumValue(OrderType, filters.type);

    const outletWhere: Prisma.OutletWhereInput = {
      franchiseId: filters.franchiseId || undefined,
      id: filters.outletId || undefined,
    };

    const billWhere: Prisma.BillWhereInput = {
      status: BillStatus.FINALIZED,
      createdAt: { gte: since },
      outlet: outletWhere,
      OR: [
        { isPrinted: true } as Prisma.BillWhereInput,
        { order: { source: { in: [OrderSource.WEBSITE, OrderSource.ZOMATO, OrderSource.SWIGGY, OrderSource.EZCATER] } } },
        { order: { type: OrderType.DELIVERY } },
      ],
    };
    const orderBillFilter = this.billOrderFilter(source, type);
    if (orderBillFilter) {
      billWhere.AND = [orderBillFilter];
    }

    const orderWhere: Prisma.OrderWhereInput = {
      createdAt: { gte: since },
      outlet: outletWhere,
      source,
      type,
    };

    const [
      bills,
      orderCount,
      activeOutletCount,
      posTotal,
      posActive,
      pendingPos,
      auditEvents,
      franchises,
      outlets,
    ] = await Promise.all([
      this.prisma.bill.findMany({
        where: billWhere,
        orderBy: { createdAt: 'asc' },
        select: {
          total: true,
          createdAt: true,
          outletId: true,
          order: { select: { source: true, type: true } },
          outlet: {
            select: {
              id: true,
              name: true,
              code: true,
              franchise: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.outlet.count({
        where: { ...outletWhere, status: OutletStatus.ACTIVE },
      }),
      this.prisma.posDevice.count({ where: { outlet: outletWhere } }),
      this.prisma.posDevice.count({
        where: { outlet: outletWhere, status: PosDeviceStatus.ACTIVE },
      }),
      this.prisma.posDevice.count({
        where: { outlet: outletWhere, status: PosDeviceStatus.PENDING },
      }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.franchise.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.outlet.findMany({
        where: { franchiseId: filters.franchiseId || undefined },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, franchiseId: true },
      }),
    ]);

    const grossSales = this.sumTotals(bills);
    const averageOrder = bills.length ? grossSales / bills.length : 0;

    return {
      filters: {
        range: filters.range,
        franchiseId: filters.franchiseId || 'ALL',
        outletId: filters.outletId || 'ALL',
        source: source || 'ALL',
        type: type || 'ALL',
      },
      options: { franchises, outlets },
      summary: {
        grossSales,
        grossSalesLabel: this.formatInr(grossSales),
        finalizedBills: bills.length,
        orders: orderCount,
        averageOrder,
        averageOrderLabel: this.formatInr(averageOrder),
        activeOutlets: activeOutletCount,
        posOnline: `${posActive}/${posTotal}`,
        pendingApprovals: pendingPos,
        auditEvents,
        systemAlerts: 0,
      },
      trend: this.buildTrend(bills, since),
      franchiseSales: this.groupByFranchise(bills),
      outletSales: this.groupByOutlet(bills),
      sourceBreakdown: this.groupBySource(bills),
      typeBreakdown: this.groupByType(bills),
    };
  }

  private groupByFranchise(bills: BillWithOrder[]) {
    const rows = new Map<string, { id: string; name: string; sales: number; bills: number }>();

    for (const bill of bills) {
      const franchise = bill.outlet.franchise;
      const key = franchise?.id || 'unassigned';
      const current = rows.get(key) || {
        id: key,
        name: franchise?.name || 'Unassigned',
        sales: 0,
        bills: 0,
      };
      current.sales += Number(bill.total);
      current.bills += 1;
      rows.set(key, current);
    }

    return this.sortedRows(rows);
  }

  private groupByOutlet(bills: BillWithOrder[]) {
    const rows = new Map<string, { id: string; name: string; sales: number; bills: number }>();

    for (const bill of bills) {
      const key = bill.outlet.id;
      const current = rows.get(key) || {
        id: key,
        name: `${bill.outlet.name} (${bill.outlet.code})`,
        sales: 0,
        bills: 0,
      };
      current.sales += Number(bill.total);
      current.bills += 1;
      rows.set(key, current);
    }

    return this.sortedRows(rows);
  }

  private groupBySource(bills: BillWithOrder[]) {
    return this.groupByEnum(bills, (bill) => bill.order?.source || OrderSource.POS);
  }

  private groupByType(bills: BillWithOrder[]) {
    return this.groupByEnum(bills, (bill) => bill.order?.type || OrderType.DINE_IN);
  }

  private groupByEnum(bills: BillWithOrder[], getKey: (bill: BillWithOrder) => string) {
    const rows = new Map<string, { key: string; sales: number; bills: number }>();

    for (const bill of bills) {
      const key = getKey(bill);
      const current = rows.get(key) || { key, sales: 0, bills: 0 };
      current.sales += Number(bill.total);
      current.bills += 1;
      rows.set(key, current);
    }

    return Array.from(rows.values())
      .sort((a, b) => b.sales - a.sales)
      .map((row) => ({ ...row, salesLabel: this.formatInr(row.sales) }));
  }

  private billOrderFilter(
    source?: OrderSource,
    type?: OrderType,
  ): Prisma.BillWhereInput | undefined {
    if (!source && !type) {
      return undefined;
    }

    const orderFilter: Prisma.OrderWhereInput = {};
    if (source) {
      orderFilter.source = source;
    }
    if (type) {
      orderFilter.type = type;
    }

    const includeDirectPos =
      (!source || source === OrderSource.POS) &&
      (!type || type === OrderType.DINE_IN);

    return {
      OR: [
        { order: { is: orderFilter } },
        ...(includeDirectPos ? [{ order: null }] : []),
      ],
    };
  }

  private sortedRows(rows: Map<string, { id: string; name: string; sales: number; bills: number }>) {
    return Array.from(rows.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8)
      .map((row) => ({ ...row, salesLabel: this.formatInr(row.sales) }));
  }

  private buildTrend(bills: BillWithOrder[], since: Date) {
    const bucketCount = 8;
    const now = new Date();
    const bucketMs = Math.max(1, (now.getTime() - since.getTime()) / bucketCount);
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(since.getTime() + bucketMs * index);
      return {
        label: this.trendLabel(start),
        sales: 0,
        bills: 0,
      };
    });

    for (const bill of bills) {
      const index = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((bill.createdAt.getTime() - since.getTime()) / bucketMs)),
      );
      buckets[index].sales += Number(bill.total);
      buckets[index].bills += 1;
    }

    return buckets.map((bucket) => ({
      ...bucket,
      salesLabel: this.formatInr(bucket.sales),
    }));
  }

  private sumTotals(bills: BillWithOrder[]) {
    return bills.reduce((total, bill) => total + Number(bill.total), 0);
  }

  private async dateFromRange(range: string, outletId?: string): Promise<Date> {
    const now = new Date();
    const hours: Record<string, number> = {
      '1h': 1,
      '4h': 4,
      '1d': 24,
      '1w': 24 * 7,
      '1m': 24 * 30,
      '3m': 24 * 90,
      '6m': 24 * 180,
      '1y': 24 * 365,
    };

    // For "today" range with a specific outlet — use the business day session start
    if (range === '1d' && outletId) {
      const latestDay = await this.prisma.outletBusinessDay.findFirst({
        where: { outletId, status: { in: ['OPEN', 'CLOSED'] } },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });

      if (latestDay) {
        return latestDay.startedAt;
      }
    }

    const selectedHours = hours[range] ?? 24;
    return new Date(now.getTime() - selectedHours * 60 * 60 * 1000);
  }


  private enumValue<T extends Record<string, string>>(
    source: T,
    value?: string,
  ): T[keyof T] | undefined {
    if (!value || value === 'ALL') {
      return undefined;
    }

    return (Object.values(source) as string[]).includes(value)
      ? (value as T[keyof T])
      : undefined;
  }

  private trendLabel(value: Date) {
    return value.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatInr(value?: number | Prisma.Decimal | null) {
    const amount = Number(value || 0);

    if (amount >= 10000000) {
      return `INR ${(amount / 10000000).toFixed(2)}Cr`;
    }

    if (amount >= 100000) {
      return `INR ${(amount / 100000).toFixed(2)}L`;
    }

    if (amount >= 1000) {
      return `INR ${(amount / 1000).toFixed(1)}K`;
    }

    return `INR ${Math.round(amount).toLocaleString('en-IN')}`;
  }
}
