import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import { PosSession } from '../pos-auth/pos-session.type';
import { AddBillItemsDto } from './dto/add-bill-items.dto';
import { BillItemInputDto } from './dto/bill-item-input.dto';
import { CancelBillDto } from './dto/cancel-bill.dto';
import { CreateBillDto } from './dto/create-bill.dto';
import { CreateKotDto } from './dto/create-kot.dto';
import { FinalizeBillDto } from './dto/finalize-bill.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class PosTerminalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async me(session: PosSession) {
    const [device, permissions] = await Promise.all([
      this.prisma.posDevice.findUniqueOrThrow({
        where: { id: session.posDeviceId },
        include: {
          outlet: {
            include: {
              franchise: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.permissions(session),
    ]);

    return { posDevice: device, outlet: device.outlet, permissions };
  }

  async menu(session: PosSession) {
    const rows = await this.prisma.outletMenuItem.findMany({
      where: {
        outletId: session.outletId,
        isActive: true,
        item: { isActive: true, category: { isActive: true } },
      },
      orderBy: [{ item: { category: { sortOrder: 'asc' } } }, { item: { name: 'asc' } }],
      include: {
        item: {
          include: {
            category: true,
            addonGroups: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: { addons: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });

    const categories = new Map<string, { id: string; name: string; items: unknown[] }>();
    for (const row of rows) {
      const category = row.item.category;
      const existing = categories.get(category.id) ?? {
        id: category.id,
        name: category.name,
        items: [],
      };

      existing.items.push({
        id: row.item.id,
        name: row.item.name,
        description: row.item.description,
        imageUrl: row.item.imageUrl,
        price: Number(row.price),
        categoryId: category.id,
        addonGroups: row.item.addonGroups.map((group) => ({
          id: group.id,
          name: group.name,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          isRequired: group.isRequired,
          addons: group.addons.map((addon) => ({
            id: addon.id,
            name: addon.name,
            price: Number(addon.price),
          })),
        })),
      });
      categories.set(category.id, existing);
    }

    return Array.from(categories.values());
  }

  async heldBills(session: PosSession) {
    return this.prisma.bill.findMany({
      where: {
        outletId: session.outletId,
        posDeviceId: session.posDeviceId,
        status: BillStatus.HELD,
      },
      orderBy: { updatedAt: 'desc' },
      include: this.billInclude(),
    });
  }

  async bills(session: PosSession) {
    const since = this.startOfDay();

    return this.prisma.bill.findMany({
      where: {
        outletId: session.outletId,
        posDeviceId: session.posDeviceId,
        createdAt: { gte: since },
      },
      orderBy: { updatedAt: 'desc' },
      include: this.billInclude(),
    });
  }

  async kotTickets(session: PosSession) {
    const since = this.startOfDay();

    return this.prisma.kotTicket.findMany({
      where: {
        bill: {
          outletId: session.outletId,
          posDeviceId: session.posDeviceId,
          createdAt: { gte: since },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { billItem: true } },
        bill: {
          include: {
            outlet: true,
            posDevice: true,
            items: true,
            payments: true,
            kotTickets: { include: { items: { include: { billItem: true } } } },
          },
        },
      },
    });
  }

  async createBill(session: PosSession, dto: CreateBillDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('At least one item is required');
    }

    const lines = await this.prepareBillItems(session.outletId, dto.items);
    const subtotal = this.sum(lines.map((line) => line.total));
    const bill = await this.prisma.bill.create({
      data: {
        outletId: session.outletId,
        posDeviceId: session.posDeviceId,
        billNumber: await this.generateBillNumber(),
        status: BillStatus.HELD,
        customerName: this.clean(dto.customerName),
        customerPhone: this.clean(dto.customerPhone),
        customerEmail: this.clean(dto.customerEmail),
        notes: this.clean(dto.notes),
        notePrintEnabled: dto.notePrintEnabled ?? true,
        subtotal,
        taxAmount: 0,
        discount: 0,
        total: subtotal,
        items: { create: lines },
      },
      include: this.billInclude(),
    });

    await this.log('POS_BILL_CREATED', 'Bill', bill.id, session, {
      billNumber: bill.billNumber,
      itemCount: dto.items.length,
    });

    return bill;
  }

  async addItems(session: PosSession, billId: string, dto: AddBillItemsDto) {
    await this.assertCanEditBill(session);
    const bill = await this.findHeldBill(session, billId);
    const lines = await this.prepareBillItems(session.outletId, dto.items);

    await this.prisma.billItem.createMany({
      data: lines.map((line) => ({
        billId,
        itemId: line.item.connect.id,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.total,
        addons: line.addons,
        notes: line.notes,
      })),
    });

    const refreshed = await this.recalculateBill(bill.id);
    await this.log('POS_BILL_ITEMS_ADDED', 'Bill', bill.id, session, {
      billNumber: bill.billNumber,
      addedItems: dto.items.length,
    });

    return refreshed;
  }

  async createKot(session: PosSession, billId: string, dto: CreateKotDto) {
    const bill = await this.findHeldBill(session, billId);
    const printedItemIds = new Set(
      bill.kotTickets.flatMap((ticket) =>
        ticket.items.map((item) => item.billItemId),
      ),
    );
    const newItems = bill.items.filter((item) => !printedItemIds.has(item.id));

    if (!newItems.length) {
      throw new BadRequestException('No new bill items are pending for KOT');
    }

    const kotCount = await this.prisma.kotTicket.count({ where: { billId } });
    const kot = await this.prisma.kotTicket.create({
      data: {
        billId,
        kotNumber: `${bill.billNumber}-KOT-${kotCount + 1}`,
        notes: this.clean(dto.notes),
        printedAt: new Date(),
        items: {
          create: newItems.map((item) => ({
            billItemId: item.id,
            quantity: item.quantity,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: { include: { billItem: true } },
        bill: { include: { outlet: true, posDevice: true } },
      },
    });

    await this.log('POS_KOT_CREATED', 'KotTicket', kot.id, session, {
      billNumber: bill.billNumber,
      kotNumber: kot.kotNumber,
    });

    return kot;
  }

  async finalizeBill(session: PosSession, billId: string, dto: FinalizeBillDto) {
    const bill = await this.findHeldBill(session, billId);
    const discount = new Prisma.Decimal(dto.discount ?? 0);
    if (discount.greaterThan(0)) {
      await this.assertPermission(
        session,
        'canApplyDiscount',
        'Discount permission is disabled',
      );
    }
    const total = new Prisma.Decimal(bill.subtotal).minus(discount);

    if (total.lessThan(0)) {
      throw new BadRequestException('Discount cannot exceed bill subtotal');
    }

    const paymentTotal = this.sum(dto.payments.map((payment) => payment.amount));
    if (!new Prisma.Decimal(paymentTotal).equals(total)) {
      throw new BadRequestException('Payment total must match bill total');
    }

    const finalized = await this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.FINALIZED,
        discount,
        total,
        finalizedAt: new Date(),
        payments: {
          create: dto.payments.map((payment) => ({
            method: payment.method as PaymentMethod,
            amount: payment.amount,
            reference: this.clean(payment.reference),
          })),
        },
      },
      include: this.billInclude(),
    });

    await this.log('POS_BILL_FINALIZED', 'Bill', billId, session, {
      billNumber: bill.billNumber,
      total: Number(total),
    });

    return finalized;
  }

  async cancelBill(session: PosSession, billId: string, dto: CancelBillDto) {
    await this.assertPermission(session, 'canCancelBill', 'Bill cancellation is disabled');
    const bill = await this.findBill(session, billId);
    if (bill.status === BillStatus.CANCELLED) {
      return bill;
    }

    const cancelled = await this.prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason,
      },
      include: this.billInclude(),
    });

    await this.log('POS_BILL_CANCELLED', 'Bill', billId, session, {
      billNumber: bill.billNumber,
      reason: dto.reason,
    });

    return cancelled;
  }

  async digitalOrders(session: PosSession) {
    const routes = await this.prisma.orderRoute.findMany({
      where: {
        outletId: session.outletId,
        posDeviceId: session.posDeviceId,
        isActive: true,
      },
      select: { source: true },
    });
    const routedSources = routes.map((route) => route.source);

    return this.prisma.order.findMany({
      where: {
        OR: [
          { posDeviceId: session.posDeviceId },
          ...(routedSources.length
            ? [
                {
                  outletId: session.outletId,
                  source: { in: routedSources },
                  posDeviceId: null,
                },
              ]
            : []),
        ],
        status: { in: [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY] },
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async updateOrderStatus(
    session: PosSession,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [{ outletId: session.outletId }, { posDeviceId: session.posDeviceId }],
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found for this POS');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: dto.status, posDeviceId: session.posDeviceId },
      include: { items: true },
    });

    await this.log('POS_DIGITAL_ORDER_STATUS_UPDATED', 'Order', orderId, session, {
      status: dto.status,
    });

    return updated;
  }

  async acceptDigitalOrder(session: PosSession, orderId: string) {
    const routes = await this.prisma.orderRoute.findMany({
      where: {
        outletId: session.outletId,
        posDeviceId: session.posDeviceId,
        isActive: true,
      },
      select: { source: true },
    });
    const routedSources = routes.map((route) => route.source);

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [
          { posDeviceId: session.posDeviceId },
          ...(routedSources.length
            ? [{ outletId: session.outletId, source: { in: routedSources } }]
            : []),
        ],
        source: { not: OrderSource.POS },
      },
      include: {
        items: true,
        bill: { include: this.billInclude() },
      },
    });

    if (!order) {
      throw new NotFoundException('Digital order not found for this POS');
    }

    if (order.bill) {
      return {
        order,
        bill: order.bill,
        kot: order.bill.kotTickets[order.bill.kotTickets.length - 1] ?? null,
        message: 'Digital order already has a POS bill',
      };
    }

    if (!order.items.length) {
      throw new BadRequestException('Digital order has no items to prepare');
    }

    const bill = await this.prisma.bill.create({
      data: {
        outletId: session.outletId,
        posDeviceId: session.posDeviceId,
        orderId: order.id,
        billNumber: await this.generateBillNumber(),
        status: BillStatus.HELD,
        customerName: this.clean(order.customerName),
        customerPhone: this.clean(order.customerPhone),
        customerEmail: this.clean(order.customerEmail),
        notes: this.clean(order.notes),
        notePrintEnabled: true,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        discount: order.discount,
        total: order.total,
        items: {
          create: order.items.map((item) => ({
            item: { connect: { id: item.itemId } },
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            addons: item.addons ?? undefined,
            notes: this.clean(item.notes),
          })),
        },
      },
      include: this.billInclude(),
    });

    const kot = await this.prisma.kotTicket.create({
      data: {
        billId: bill.id,
        kotNumber: `${bill.billNumber}-KOT-1`,
        notes: this.clean(order.notes),
        printedAt: new Date(),
        items: {
          create: bill.items.map((item) => ({
            billItemId: item.id,
            quantity: item.quantity,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: { include: { billItem: true } },
        bill: { include: { outlet: true, posDevice: true } },
      },
    });

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PREPARING,
        posDeviceId: session.posDeviceId,
      },
      include: { items: true },
    });

    await this.log('POS_DIGITAL_ORDER_ACCEPTED', 'Order', orderId, session, {
      billNumber: bill.billNumber,
      kotNumber: kot.kotNumber,
      source: order.source,
    });

    return {
      order: updatedOrder,
      bill: await this.prisma.bill.findUniqueOrThrow({
        where: { id: bill.id },
        include: this.billInclude(),
      }),
      kot,
      message: 'Digital order accepted. Bill and first KOT created.',
    };
  }

  async shiftSummary(session: PosSession) {
    const since = this.startOfDay();

    const [sales, bills, heldBills, kotTickets, payments] = await Promise.all([
      this.prisma.bill.aggregate({
        where: {
          posDeviceId: session.posDeviceId,
          status: BillStatus.FINALIZED,
          createdAt: { gte: since },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.bill.findMany({
        where: { posDeviceId: session.posDeviceId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { payments: true },
      }),
      this.prisma.bill.count({
        where: { posDeviceId: session.posDeviceId, status: BillStatus.HELD },
      }),
      this.prisma.kotTicket.count({
        where: {
          bill: {
            posDeviceId: session.posDeviceId,
            createdAt: { gte: since },
          },
        },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          bill: {
            posDeviceId: session.posDeviceId,
            status: BillStatus.FINALIZED,
            createdAt: { gte: since },
          },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      since,
      totalSales: Number(sales._sum.total ?? 0),
      finalizedBills: sales._count,
      heldBills,
      kotTickets,
      payments: payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment._sum.amount ?? 0),
      })),
      recentBills: bills,
    };
  }

  private async prepareBillItems(outletId: string, items: BillItemInputDto[]) {
    const outletItems = await this.prisma.outletMenuItem.findMany({
      where: {
        outletId,
        itemId: { in: items.map((item) => item.itemId) },
        isActive: true,
        item: { isActive: true },
      },
      include: {
        item: {
          include: {
            addonGroups: { include: { addons: true } },
          },
        },
      },
    });
    const byItemId = new Map(outletItems.map((row) => [row.itemId, row]));

    return items.map((item) => {
      const outletItem = byItemId.get(item.itemId);
      if (!outletItem) {
        throw new NotFoundException('Menu item is not available for this outlet');
      }

      const validAddonIds = new Map(
        outletItem.item.addonGroups.flatMap((group) =>
          group.addons.map((addon) => [addon.id, addon]),
        ),
      );
      const addons = item.addons ?? [];
      for (const addon of addons) {
        if (!validAddonIds.has(addon.addonId)) {
          throw new BadRequestException(`Invalid add-on selected for ${outletItem.item.name}`);
        }
      }

      const addonTotal = addons.reduce((total, addon) => total + Number(addon.price), 0);
      const unitPrice = new Prisma.Decimal(outletItem.price).plus(addonTotal);
      const total = unitPrice.times(item.quantity);

      return {
        item: { connect: { id: item.itemId } },
        name: outletItem.item.name,
        quantity: item.quantity,
        unitPrice,
        total,
        addons: addons.length ? (addons as unknown as Prisma.InputJsonValue) : undefined,
        notes: this.clean(item.notes),
      };
    });
  }

  private startOfDay() {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    return since;
  }

  private async recalculateBill(billId: string) {
    const bill = await this.prisma.bill.findUniqueOrThrow({
      where: { id: billId },
      include: { items: true },
    });
    const subtotal = bill.items.reduce(
      (total, item) => total.plus(item.total),
      new Prisma.Decimal(0),
    );
    const total = subtotal.minus(bill.discount);

    return this.prisma.bill.update({
      where: { id: billId },
      data: { subtotal, total },
      include: this.billInclude(),
    });
  }

  private async findHeldBill(session: PosSession, billId: string) {
    const bill = await this.findBill(session, billId);
    if (bill.status !== BillStatus.HELD) {
      throw new BadRequestException('Only held bills can be changed');
    }
    return bill;
  }

  private async findBill(session: PosSession, billId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: {
        id: billId,
        outletId: session.outletId,
        posDeviceId: session.posDeviceId,
      },
      include: this.billInclude(),
    });

    if (!bill) {
      throw new NotFoundException('Bill not found for this POS');
    }

    return bill;
  }

  private async assertCanEditBill(session: PosSession) {
    const permissions = await this.permissions(session);
    if (!permissions.canEditBill) {
      throw new ForbiddenException('Bill editing is disabled');
    }
  }

  private async assertPermission(
    session: PosSession,
    permission: 'canCancelBill' | 'canApplyDiscount' | 'canReprintBill',
    message: string,
  ) {
    const permissions = await this.permissions(session);
    if (!permissions[permission]) {
      throw new ForbiddenException(message);
    }
  }

  private async permissions(session: PosSession) {
    const rows = await this.prisma.userPermission.findMany({
      where: {
        OR: [
          { posDeviceId: session.posDeviceId },
          { outletId: session.outletId },
        ],
      },
    });

    return {
      canEditBill: rows.length ? rows.some((row) => row.canEditBill) : true,
      canCancelBill: rows.some((row) => row.canCancelBill),
      canApplyDiscount: rows.some((row) => row.canApplyDiscount),
      canReprintBill: rows.some((row) => row.canReprintBill),
      canViewReports: rows.length ? rows.some((row) => row.canViewReports) : true,
    };
  }

  private async generateBillNumber() {
    const today = new Date();
    const stamp = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');
    const count = await this.prisma.bill.count({
      where: {
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        },
      },
    });
    return `BF-${stamp}-${String(count + 1).padStart(4, '0')}`;
  }

  private sum(values: Array<number | Prisma.Decimal>) {
    return values.reduce<Prisma.Decimal>(
      (total, value) => total.plus(value),
      new Prisma.Decimal(0),
    );
  }

  private billInclude() {
    return {
      outlet: true,
      posDevice: true,
      items: { orderBy: { id: 'asc' as const } },
      kotTickets: {
        orderBy: { createdAt: 'asc' as const },
        include: { items: { include: { billItem: true } } },
      },
      payments: true,
      order: true,
    };
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private log(
    action: string,
    entityType: string,
    entityId: string,
    session: PosSession,
    metadata?: unknown,
  ) {
    return this.auditService.createLog({
      action,
      entityType,
      entityId,
      metadata: JSON.parse(
        JSON.stringify({
          posDeviceId: session.posDeviceId,
          outletId: session.outletId,
          ...((metadata ?? {}) as Record<string, unknown>),
        }),
      ) as Prisma.InputJsonValue,
    });
  }
}
