import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillStatus,
  BusinessDayStatus,
  OrderSource,
  OrderStatus,
  OrderType,
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
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ZomatoIntegrationService } from './zomato-integration.service';

@Injectable()
export class PosTerminalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly zomatoService: ZomatoIntegrationService,
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

    // Auto-create or attach to active business day for this outlet
    let activeDay = await this.prisma.outletBusinessDay.findFirst({
      where: { outletId: session.outletId, status: BusinessDayStatus.OPEN },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeDay) {
      activeDay = await this.prisma.outletBusinessDay.create({
        data: {
          outletId: session.outletId,
          posDeviceId: session.posDeviceId,
          status: BusinessDayStatus.OPEN,
          startedAt: new Date(),
        },
      });
      await this.log('POS_DAY_AUTO_STARTED', 'OutletBusinessDay', activeDay.id, session, {
        reason: 'Auto-initialized on first bill creation',
        startedAt: activeDay.startedAt,
      });
    }

    try {
      const lines = await this.prepareBillItems(session.outletId, dto.items);
      const subtotal = this.sum(lines.map((line) => line.total));
      const billNumber = await this.generateBillNumber(session);

      const bill = await this.prisma.bill.create({
        data: {
          outletId: session.outletId,
          posDeviceId: session.posDeviceId,
          billNumber,
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
          businessDayId: activeDay.id,
          items: { create: lines },
        },
        include: this.billInclude(),
      });

      await this.log('POS_BILL_CREATED', 'Bill', bill.id, session, {
        billNumber: bill.billNumber,
        itemCount: dto.items.length,
        businessDayId: activeDay.id,
      });

      return bill;
    } catch (error) {
      console.error('Error creating POS bill:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create bill in POS database',
      );
    }
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
    const bill = await this.findBill(session, billId);
    const printedItemIds = new Set(
      bill.kotTickets.flatMap((ticket) =>
        ticket.items.map((item) => item.billItemId),
      ),
    );
    let newItems = bill.items.filter((item) => !printedItemIds.has(item.id));

    // Fallback for re-print KOT: If all items were printed in a previous KOT, use all items
    if (!newItems.length) {
      newItems = bill.items;
    }

    if (!newItems.length) {
      throw new BadRequestException('No items available in this bill for KOT');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayKotCount = await this.prisma.kotTicket.count({
      where: {
        createdAt: { gte: startOfDay },
        bill: { outletId: session.outletId },
      },
    });

    const kotSeq = todayKotCount + 1;
    const kotNumber = `KOT-${kotSeq}`;

    const kot = await this.prisma.kotTicket.create({
      data: {
        billId,
        kotNumber,
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

    void this.notificationsService.createNotification({
      recipientRole: 'FRANCHISE_OWNER',
      outletId: session.outletId,
      title: `🍳 Kitchen KOT #${kot.kotNumber}`,
      message: `Outlet ${kot.bill?.outlet?.name || 'POS'}: Dispatched ${kot.items.length} items to kitchen for Bill #${bill.billNumber}`,
      type: 'INFO',
    });

    return kot;
  }

  async finalizeBill(session: PosSession, billId: string, dto: FinalizeBillDto) {
    const bill = await this.findBill(session, billId);
    if (bill.status === BillStatus.FINALIZED) {
      return bill;
    }

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
        isPrinted: true,
        printedAt: new Date(),
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
      } as any,
      include: this.billInclude(),
    });

    await this.log('POS_BILL_FINALIZED', 'Bill', billId, session, {
      billNumber: bill.billNumber,
      total: Number(total),
    });

    void this.notificationsService.createNotification({
      recipientRole: 'FRANCHISE_OWNER',
      outletId: session.outletId,
      title: `🧾 Bill Paid #${finalized.billNumber}`,
      message: `Outlet ${(finalized as any).outlet?.name || 'POS'}: Paid ₹${finalized.total} for ${finalized.customerName || 'Walk-in'}`,
      type: 'SUCCESS',
    });

    void this.notificationsService.createNotification({
      recipientRole: 'SUPERADMIN',
      outletId: session.outletId,
      title: `🧾 Bill Paid #${finalized.billNumber}`,
      message: `Outlet ${(finalized as any).outlet?.name || 'POS'}: Paid ₹${finalized.total} for ${finalized.customerName || 'Walk-in'}`,
      type: 'SUCCESS',
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

  async acceptDigitalOrder(session: PosSession, orderId: string, dto?: { driverId?: string; driverName?: string; driverPhone?: string }) {
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
        billNumber: await this.generateBillNumber(session),
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
        ...(dto?.driverName ? {
          driverName: dto.driverName,
          driverPhone: dto.driverPhone || '9876543210',
          assignedTeamMemberId: dto.driverId || 'tm-1',
          deliveryStatus: 'OUT_FOR_DELIVERY',
        } : {}),
      },
      include: { items: true, outlet: true },
    });

    await this.log('POS_DIGITAL_ORDER_ACCEPTED', 'Order', orderId, session, {
      billNumber: bill.billNumber,
      kotNumber: kot.kotNumber,
      source: order.source,
      driverName: dto?.driverName,
    });

    const customerTrackingUrl = `http://localhost:3003/track/${order.id}`;
    const driverNavUrl = `http://localhost:3003/delivery-nav/${order.id}`;

    if (order.type === OrderType.DELIVERY && dto?.driverName) {
      void this.notificationsService.createNotification({
        recipientRole: 'FRANCHISE_OWNER',
        outletId: session.outletId,
        title: `🚚 Delivery Assigned: ${dto.driverName}`,
        message: `Order #${order.id.slice(-6)} assigned to ${dto.driverName} (${dto.driverPhone}). Customer tracking link ready.`,
        type: 'SUCCESS',
      });
    }

    return {
      order: updatedOrder,
      bill: await this.prisma.bill.findUniqueOrThrow({
        where: { id: bill.id },
        include: this.billInclude(),
      }),
      kot,
      customerTrackingUrl,
      driverNavUrl,
      message: 'Digital order accepted. Bill and first KOT created.',
    };
  }

  async updateDeliveryStatus(orderId: string, deliveryStatus: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { outlet: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus,
        status: deliveryStatus === 'DELIVERED' ? OrderStatus.COMPLETED : OrderStatus.PREPARING,
      } as any,
      include: { outlet: true, items: true },
    });

    void this.notificationsService.createNotification({
      recipientRole: 'FRANCHISE_OWNER',
      outletId: order.outletId,
      title: `🛵 Delivery Status Updated: ${deliveryStatus}`,
      message: `Order #${orderId.slice(-6)} status updated to ${deliveryStatus} by driver ${(order as any).driverName || 'Staff'}.`,
      type: deliveryStatus === 'DELIVERED' ? 'SUCCESS' : 'INFO',
    });

    return {
      success: true,
      order: updated,
      message: `Delivery status updated to ${deliveryStatus}`,
    };
  }

  async getDeliveryOrderDetails(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { outlet: true, items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const destAddress = (order as any).deliveryAddress || `${order.outlet.address}, Varachha, Surat`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destAddress)}`;

    return {
      id: order.id,
      customerName: order.customerName || 'Customer',
      customerPhone: order.customerPhone || '9876543210',
      deliveryAddress: destAddress,
      googleMapsUrl,
      distanceKm: 3.2,
      estimatedTimeMins: 12,
      driverName: (order as any).driverName || 'Sahir Qureshi',
      driverPhone: (order as any).driverPhone || '9876543210',
      deliveryStatus: (order as any).deliveryStatus || 'OUT_FOR_DELIVERY',
      orderType: order.type,
      source: order.source,
      total: Number(order.total),
      outletName: order.outlet.name,
      outletCode: order.outlet.code,
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: Number(i.unitPrice) })),
      customerTrackingUrl: `http://localhost:3003/track/${order.id}`,
      driverNavUrl: `http://localhost:3003/delivery-nav/${order.id}`,
    };
  }

  async shiftSummary(session: PosSession) {
    try {
      // Use business day start time if available, fall back to calendar midnight
      const activeDay = await this.prisma.outletBusinessDay.findFirst({
        where: { outletId: session.outletId, status: BusinessDayStatus.OPEN },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });
      const since = activeDay?.startedAt ?? this.startOfDay();

      const [allShiftBills, sales, bills, heldBills, kotTickets, payments, printedSales] = await Promise.all([
        this.prisma.bill.findMany({
          where: { posDeviceId: session.posDeviceId, createdAt: { gte: since } },
          select: { id: true, total: true, isPrinted: true, status: true } as any,
        }),
        this.prisma.bill.aggregate({
          where: {
            posDeviceId: session.posDeviceId,
            createdAt: { gte: since },
            status: { not: BillStatus.CANCELLED },
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
        this.prisma.bill.aggregate({
          where: {
            posDeviceId: session.posDeviceId,
            createdAt: { gte: since },
            status: { not: BillStatus.CANCELLED },
            isPrinted: true,
          } as any,
          _sum: { total: true },
        }),
      ]);

      const totalOrdersCount = sales._count ?? 0;
      const totalSalesAmount = Number(sales._sum?.total ?? 0);
      const printedSalesAmount = Number(printedSales._sum?.total ?? 0);
      const target70PercentAmount = Math.ceil(totalSalesAmount * 0.7);
      const printComplianceRatio = totalSalesAmount > 0 ? Number(((printedSalesAmount / totalSalesAmount) * 100).toFixed(1)) : 100;
      
      const isComplianceThresholdActive = totalOrdersCount >= 20;
      const canCloseDay = !isComplianceThresholdActive || printedSalesAmount >= target70PercentAmount;

      return {
        since,
        totalSales: totalSalesAmount,
        finalizedBills: sales._count ?? 0,
        heldBills: heldBills ?? 0,
        kotTickets: kotTickets ?? 0,
        totalOrdersCount,
        printedSalesAmount,
        target70PercentAmount,
        printComplianceRatio,
        isComplianceThresholdActive,
        canCloseDay,
        payments: (payments || []).map((payment) => ({
          method: payment.method,
          amount: Number(payment._sum?.amount ?? 0),
        })),
        recentBills: bills || [],
      };
    } catch (err) {
      console.error('Error calculating shiftSummary:', err);
      return {
        since: this.startOfDay(),
        totalSales: 0,
        finalizedBills: 0,
        heldBills: 0,
        kotTickets: 0,
        totalOrdersCount: 0,
        printedSalesAmount: 0,
        target70PercentAmount: 0,
        printComplianceRatio: 100,
        isComplianceThresholdActive: false,
        canCloseDay: true,
        payments: [],
        recentBills: [],
      };
    }
  }

  async teamMembers(session: PosSession) {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { outletId: session.outletId },
          { franchise: { outlets: { some: { id: session.outletId } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return users.map((u) => ({
      ...u,
      fullName: u.name,
      status: 'PRESENT',
      checkInTime: '09:00 AM',
    }));
  }

  async startDay(session: PosSession, openingFloat: number) {
    // Check for existing open business day for this outlet
    const existing = await this.prisma.outletBusinessDay.findFirst({
      where: { outletId: session.outletId, status: BusinessDayStatus.OPEN },
    });

    if (existing) {
      return {
        success: true,
        status: 'OPEN',
        openingFloat,
        businessDayId: existing.id,
        startedAt: existing.startedAt.toISOString(),
        message: 'Business Day is already active and open.',
      };
    }

    // Create new business day record
    const businessDay = await this.prisma.outletBusinessDay.create({
      data: {
        outletId: session.outletId,
        posDeviceId: session.posDeviceId,
        status: BusinessDayStatus.OPEN,
        startedAt: new Date(),
      },
    });

    await this.log('POS_DAY_STARTED', 'OutletBusinessDay', businessDay.id, session, { openingFloat, startedAt: businessDay.startedAt });

    void this.notificationsService.createNotification({
      recipientRole: 'FRANCHISE_OWNER',
      outletId: session.outletId,
      title: '🌅 Register Day Started',
      message: `Shift started with opening float ₹${openingFloat}`,
      type: 'INFO',
    });

    void this.notificationsService.createNotification({
      recipientRole: 'SUPERADMIN',
      outletId: session.outletId,
      title: '🌅 Register Day Started',
      message: `Shift started with opening float ₹${openingFloat}`,
      type: 'INFO',
    });

    return {
      success: true,
      status: 'OPEN',
      openingFloat,
      businessDayId: businessDay.id,
      startedAt: businessDay.startedAt.toISOString(),
      message: 'Shift / Day Started Successfully',
    };
  }

  async endDay(session: PosSession, closingNotes?: string) {
    const summary = await this.shiftSummary(session);

    if (!summary.canCloseDay) {
      throw new BadRequestException(
        `Cannot close register! GST policy requires minimum 70% printed bill sales compliance. Current printed: ₹${summary.printedSalesAmount} (${summary.printComplianceRatio}%). Required target: ₹${summary.target70PercentAmount}. Please select unprinted bills to print.`
      );
    }

    // Close the active business day record
    const activeDay = await this.prisma.outletBusinessDay.findFirst({
      where: { outletId: session.outletId, status: BusinessDayStatus.OPEN },
      orderBy: { startedAt: 'desc' },
    });

    if (activeDay) {
      await this.prisma.outletBusinessDay.update({
        where: { id: activeDay.id },
        data: { status: BusinessDayStatus.CLOSED, endedAt: new Date() },
      });
    }

    await this.log('POS_DAY_ENDED', 'PosDevice', session.posDeviceId, session, { closingNotes, summary });

    void this.notificationsService.createNotification({
      recipientRole: 'FRANCHISE_OWNER',
      outletId: session.outletId,
      title: '🌙 Shift Closed & Z-Report',
      message: `Shift ended. Total sales today: ₹${summary.totalSales.toLocaleString('en-IN')}`,
      type: 'ALERT',
    });

    void this.notificationsService.createNotification({
      recipientRole: 'SUPERADMIN',
      outletId: session.outletId,
      title: '🌙 Shift Closed & Z-Report',
      message: `Shift ended. Total sales today: ₹${summary.totalSales.toLocaleString('en-IN')}`,
      type: 'ALERT',
    });

    return {
      success: true,
      status: 'CLOSED',
      endedAt: new Date().toISOString(),
      summary,
      message: 'Day Ended. Z-Report generated.',
    };
  }

  async getUnprintedBills(session: PosSession) {
    const activeDay = await this.prisma.outletBusinessDay.findFirst({
      where: { outletId: session.outletId, status: BusinessDayStatus.OPEN },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    const since = activeDay?.startedAt ?? this.startOfDay();

    const [unprintedBills, printedCount, outlet] = await Promise.all([
      this.prisma.bill.findMany({
        where: {
          outletId: session.outletId,
          createdAt: { gte: since },
          status: { not: BillStatus.CANCELLED },
          isPrinted: false,
        } as any,
        orderBy: { createdAt: 'asc' },
        include: { items: true, kotTickets: true },
      }),
      this.prisma.bill.count({
        where: {
          outletId: session.outletId,
          isPrinted: true,
        },
      }),
      this.prisma.outlet.findUnique({
        where: { id: session.outletId },
        select: { code: true, name: true },
      }),
    ]);

    const prefix = outlet?.code?.replace('OLT-', '') || 'KIRTI';
    const nextInvoiceStart = printedCount + 1;

    const timeSlots: Record<string, any[]> = {};
    for (let i = 0; i < unprintedBills.length; i++) {
      const bill = unprintedBills[i];
      const date = new Date(bill.createdAt);
      const hour = date.getHours();
      const slotStart = Math.floor(hour / 3) * 3;
      const slotEnd = slotStart + 3;
      const slotLabel = `${slotStart.toString().padStart(2, '0')}:00 - ${slotEnd.toString().padStart(2, '0')}:00`;
      
      if (!timeSlots[slotLabel]) timeSlots[slotLabel] = [];
      const billItems = (bill as any).items || [];
      const kotNumber = (bill as any).kotTickets?.[0]?.kotNumber || `KOT #${i + 1}`;

      timeSlots[slotLabel].push({
        id: bill.id,
        kotNumber,
        createdAt: bill.createdAt,
        total: Number(bill.total),
        customerName: bill.customerName || 'Counter Order',
        itemCount: billItems.length,
        itemsSummary: billItems.map((item: any) => `${item.quantity}x ${item.name}`).join(', '),
      });
    }

    const summary = await this.shiftSummary(session);

    return {
      timeSlots,
      totalUnprintedCount: unprintedBills.length,
      nextInvoiceStart,
      invoicePrefix: `INV-${prefix}-`,
      summary,
    };
  }

  async batchPrintComplianceBills(session: PosSession, billIds: string[]) {
    if (!billIds.length) {
      throw new BadRequestException('No bill IDs provided for batch printing');
    }

    const outlet = await this.prisma.outlet.findUnique({
      where: { id: session.outletId },
      select: { code: true },
    });
    const prefix = outlet?.code?.replace('OLT-', '') || 'KIRTI';

    // Fetch current printed count to assign strictly consecutive invoice numbers
    const currentPrintedCount = await this.prisma.bill.count({
      where: {
        outletId: session.outletId,
        isPrinted: true,
      },
    });

    let nextInvNum = currentPrintedCount + 1;
    const billsToPrint = await this.prisma.bill.findMany({
      where: { id: { in: billIds } },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();

    // Assign sequential gap-free invoice numbers in a transaction
    await this.prisma.$transaction(
      billsToPrint.map((bill) => {
        const sequentialInv = `INV-${prefix}-${String(nextInvNum++).padStart(3, '0')}`;
        return this.prisma.bill.update({
          where: { id: bill.id },
          data: {
            billNumber: sequentialInv,
            isPrinted: true,
            printedAt: now,
            status: BillStatus.FINALIZED,
            finalizedAt: bill.createdAt,
          } as any,
        });
      })
    );

    const printedBills = await this.prisma.bill.findMany({
      where: { id: { in: billIds } },
      orderBy: { createdAt: 'asc' },
      include: this.billInclude(),
    });

    const updatedSummary = await this.shiftSummary(session);

    return {
      success: true,
      printedCount: printedBills.length,
      printedBills,
      summary: updatedSummary,
      message: `Successfully generated and printed ${printedBills.length} bills in sequential order.`,
    };
  }

  async getSettings(session: PosSession) {
    const device = await this.prisma.posDevice.findUniqueOrThrow({
      where: { id: session.posDeviceId },
    });
    return {
      twoFactorEnabled: true,
      printer: {
        name: 'Thermal Receipt Printer (80mm)',
        ipAddress: '192.168.1.100',
        paperWidth: '80mm',
        autoCut: true,
      },
      deviceCode: device.deviceCode,
      name: device.name,
    };
  }

  async getItemChannels(session: PosSession) {
    const items = await this.prisma.outletMenuItem.findMany({
      where: { outletId: session.outletId },
      include: {
        item: {
          include: { category: true },
        },
      },
      orderBy: { item: { name: 'asc' } },
    });

    return items.map((row) => ({
      id: row.id,
      itemId: row.itemId,
      name: row.item.name,
      category: row.item.category.name,
      price: Number(row.price),
      channels: {
        pos: row.isActive,
        website: row.dineIn,
        zomato: row.delivery,
        swiggy: row.takeaway,
        ezcater: row.isActive && row.delivery,
      },
    }));
  }

  async updateItemChannel(session: PosSession, id: string, body: { channel: string; enabled: boolean }) {
    const item = await this.prisma.outletMenuItem.findFirst({
      where: { id, outletId: session.outletId },
    });
    if (!item) {
      throw new NotFoundException('Item not found for this outlet');
    }

    const updateData: Prisma.OutletMenuItemUpdateInput = {};
    if (body.channel === 'pos') updateData.isActive = body.enabled;
    if (body.channel === 'website') updateData.dineIn = body.enabled;
    if (body.channel === 'zomato') updateData.delivery = body.enabled;
    if (body.channel === 'swiggy') updateData.takeaway = body.enabled;
    if (body.channel === 'ezcater') updateData.isActive = body.enabled;

    const updated = await this.prisma.outletMenuItem.update({
      where: { id },
      data: updateData,
      include: { item: { include: { category: true } } },
    });

    await this.log('POS_ITEM_CHANNEL_TOGGLED', 'OutletMenuItem', id, session, {
      channel: body.channel,
      enabled: body.enabled,
    });

    void this.notificationsService.createNotification({
      recipientRole: 'FRANCHISE_OWNER',
      outletId: session.outletId,
      title: '⚠️ Item Channel Status Changed',
      message: `Item "${updated.item.name}" toggled ${body.enabled ? 'ON' : 'OFF'} for ${body.channel.toUpperCase()}`,
      type: 'WARNING',
    });

    void this.notificationsService.createNotification({
      recipientRole: 'SUPERADMIN',
      outletId: session.outletId,
      title: '⚠️ Item Channel Status Changed',
      message: `Item "${updated.item.name}" toggled ${body.enabled ? 'ON' : 'OFF'} for ${body.channel.toUpperCase()}`,
      type: 'WARNING',
    });

    return {
      id: updated.id,
      name: updated.item.name,
      category: updated.item.category.name,
      price: Number(updated.price),
      channels: {
        pos: updated.isActive,
        website: updated.dineIn,
        zomato: updated.delivery,
        swiggy: updated.takeaway,
        ezcater: updated.isActive && updated.delivery,
      },
    };
  }

  async updatePrinterSettings(session: PosSession, body: { printerName?: string; printerIp?: string; paperWidth?: string }) {
    await this.log('POS_PRINTER_SETTINGS_UPDATED', 'PosDevice', session.posDeviceId, session, body);
    return {
      success: true,
      message: 'Printer settings updated successfully',
      ...body,
    };
  }

  async toggle2FA(session: PosSession, enabled: boolean) {
    await this.log('POS_2FA_TOGGLED', 'PosDevice', session.posDeviceId, session, { enabled });

    void this.notificationsService.createNotification({
      recipientRole: 'FRANCHISE_OWNER',
      outletId: session.outletId,
      title: '🛡️ Security Setting Updated',
      message: `Two-Factor Authentication ${enabled ? 'Enabled' : 'Disabled'}`,
      type: 'WARNING',
    });

    void this.notificationsService.createNotification({
      recipientRole: 'SUPERADMIN',
      outletId: session.outletId,
      title: '🛡️ Security Setting Updated',
      message: `Two-Factor Authentication ${enabled ? 'Enabled' : 'Disabled'}`,
      type: 'WARNING',
    });

    return {
      success: true,
      twoFactorEnabled: enabled,
      message: enabled ? '2FA Protection Enabled' : '2FA Protection Disabled',
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

  private async generateBillNumber(session: PosSession) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let count = await this.prisma.bill.count({
      where: {
        createdAt: { gte: startOfDay },
        outletId: session.outletId,
      },
    });

    let billNumber = `BILL-${count + 1}`;
    let attempts = 0;
    while (attempts < 100) {
      const existing = await this.prisma.bill.findUnique({
        where: { billNumber },
      });
      if (!existing) {
        return billNumber;
      }
      count++;
      billNumber = `BILL-${count + 1}`;
      attempts++;
    }

    return `BILL-${Date.now()}`;
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

  async processOnlineWebhookOrder(data: { source: string; rawPayload: any }) {
    const payload = data.rawPayload || {};
    const storeId =
      payload.store_id ||
      payload.restaurant_id ||
      payload.res_id ||
      payload.order?.details?.store_id ||
      payload.order?.store_id ||
      payload.outlet_code;

    let outlet = storeId
      ? await this.prisma.outlet.findFirst({
          where: { OR: [{ id: storeId }, { code: storeId }] },
        })
      : null;

    if (!outlet) {
      outlet = await this.prisma.outlet.findFirst();
    }

    if (!outlet) {
      return { status: 'error', message: 'No active outlet found for online order routing' };
    }

    const customerName =
      payload.customer_name ||
      payload.order?.details?.customer?.name ||
      `${data.source} Customer`;
    const customerPhone =
      payload.customer_phone ||
      payload.order?.details?.customer?.phone ||
      '9876543210';
    const totalAmount = Number(
      payload.total_amount || payload.order?.details?.order_total || payload.amount || 0,
    );

    const rawItems: any[] =
      payload.items ||
      payload.order?.items ||
      payload.order?.details?.items ||
      [];

    const fallbackMenuItem = await this.prisma.menuItem.findFirst();

    const orderItemsData: Array<{
      itemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      total: number;
      notes?: string;
    }> = [];

    for (const rawItem of rawItems) {
      const itemName = rawItem.name || rawItem.title || rawItem.item_name || 'Falooda Item';
      const qty = Number(rawItem.quantity || rawItem.qty || 1);
      const unitPrice = Number(rawItem.unit_price || rawItem.price || 0);
      const itemTotal = unitPrice * qty;

      const matchedMenuItem = await this.prisma.menuItem.findFirst({
        where: { name: { contains: itemName, mode: 'insensitive' } },
      });

      orderItemsData.push({
        itemId: matchedMenuItem?.id || fallbackMenuItem?.id || 'default-item',
        name: itemName,
        quantity: qty,
        unitPrice,
        total: itemTotal,
        notes: rawItem.instructions || rawItem.notes || undefined,
      });
    }

    if (orderItemsData.length === 0 && fallbackMenuItem) {
      orderItemsData.push({
        itemId: fallbackMenuItem.id,
        name: `${data.source} Online Order`,
        quantity: 1,
        unitPrice: totalAmount,
        total: totalAmount,
      });
    }

    const sourceEnum =
      data.source === 'ZOMATO'
        ? OrderSource.ZOMATO
        : data.source === 'SWIGGY'
          ? OrderSource.SWIGGY
          : OrderSource.EZCATER;

    const order = await this.prisma.order.create({
      data: {
        outletId: outlet.id,
        source: sourceEnum,
        type: OrderType.DELIVERY,
        status: OrderStatus.ACCEPTED,
        customerName,
        customerPhone,
        total: totalAmount,
        subtotal: totalAmount,
        taxAmount: 0,
        discount: 0,
        notes: `Auto-Accepted Online Order via ${data.source} (${payload.order_id || payload.order?.details?.order_id || 'ID-' + Date.now()})`,
        items: {
          create: orderItemsData.map((item) => ({
            itemId: item.itemId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            notes: item.notes,
          })),
        },
      },
      include: { items: true },
    });

    const posDevice = await this.prisma.posDevice.findFirst({
      where: { outletId: outlet.id },
    });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let billCount = await this.prisma.bill.count({
      where: {
        createdAt: { gte: startOfDay },
        outletId: outlet.id,
      },
    });

    let billNumber = `BILL-${billCount + 1}`;
    let billAttempts = 0;
    while (billAttempts < 100) {
      const existing = await this.prisma.bill.findUnique({
        where: { billNumber },
      });
      if (!existing) {
        break;
      }
      billCount++;
      billNumber = `BILL-${billCount + 1}`;
      billAttempts++;
    }

    const bill = await this.prisma.bill.create({
      data: {
        outletId: outlet.id,
        posDeviceId: posDevice?.id || 'pos-default',
        orderId: order.id,
        billNumber,
        status: BillStatus.HELD,
        customerName,
        customerPhone,
        notes: order.notes,
        subtotal: totalAmount,
        taxAmount: 0,
        discount: 0,
        total: totalAmount,
        items: {
          create: orderItemsData.map((item) => ({
            itemId: item.itemId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            notes: item.notes,
          })),
        },
        // Link to current open business day if one exists for this outlet
        businessDayId: await this.prisma.outletBusinessDay
          .findFirst({
            where: { outletId: outlet.id, status: BusinessDayStatus.OPEN },
            orderBy: { startedAt: 'desc' },
            select: { id: true },
          })
          .then((d) => d?.id ?? null),
      },
      include: this.billInclude(),
    });

    const kotCount = await this.prisma.kotTicket.count({
      where: {
        createdAt: { gte: startOfDay },
        bill: { outletId: outlet.id },
      },
    });

    const kot = await this.prisma.kotTicket.create({
      data: {
        billId: bill.id,
        kotNumber: `KOT-${kotCount + 1}`,
        notes: order.notes,
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

    void this.notificationsService.createNotification({
      recipientRole: 'FRANCHISE_OWNER',
      outletId: outlet.id,
      title: `🛵 New ${data.source} Order Auto-Accepted!`,
      message: `Order #${order.id.slice(-6)} (${customerName}) for ₹${totalAmount} — KOT #${kot.kotNumber} generated for kitchen.`,
      type: 'SUCCESS',
    });

    const zomatoOrderId = payload?.order_id || payload?.order?.details?.order_id || payload?.order_details?.order_id;
    if (data.source === 'ZOMATO' && zomatoOrderId) {
      void this.zomatoService.confirmOrder(zomatoOrderId, 15);
    }

    return {
      status: 'success',
      order_id: zomatoOrderId || order.id,
      prep_time: 15,
      orderId: order.id,
      billId: bill.id,
      kotNumber: kot.kotNumber,
      message: `Online order from ${data.source} auto-accepted & routed to outlet ${outlet.name}`,
    };
  }

  /**
   * Universal Zomato Webhook Dispatcher:
   * Safely discriminates event type from single or mixed webhook payload
   */
  async handleZomatoWebhookUniversal(payload: any) {
    const eventType = (payload?.event_type || payload?.action || payload?.event || '').toUpperCase();

    if (eventType.includes('RIDER') || payload?.rider_details || payload?.delivery_partner) {
      return this.handleZomatoRiderStatusUpdate(payload);
    }
    if (eventType.includes('CANCEL') || payload?.cancellation_reason || payload?.mac) {
      return this.handleZomatoCancellation(payload);
    }
    if (eventType.includes('STATUS') || payload?.order_status === 'REJECTED' || payload?.order_status === 'TIMEOUT') {
      return this.handleZomatoOrderStatusUpdate(payload);
    }
    if (eventType.includes('COMPLAINT') || payload?.complaint) {
      return this.handleZomatoComplaint(payload);
    }
    if (eventType.includes('RATING') || payload?.rating !== undefined) {
      return this.handleZomatoRating(payload);
    }

    // Default: New Order Relay
    return this.processOnlineWebhookOrder({
      source: 'ZOMATO',
      rawPayload: payload,
    });
  }

  /**
   * Zomato Order Status Update Webhook (Rejections, Timeouts, Status Sync)
   * Doc: /online-ordering/v1/order-status/webhook
   */
  async handleZomatoOrderStatusUpdate(payload: any) {
    const orderId = payload?.order_id || payload?.order?.details?.order_id || 'UNKNOWN';
    const status = payload?.order_status || payload?.status || 'UPDATED';
    const reason = payload?.reason || payload?.rejection_reason || 'Status updated via Zomato';

    const order = await this.prisma.order.findFirst({
      where: { notes: { contains: orderId } },
      include: { outlet: true },
    });

    if (order) {
      if (status === 'REJECTED' || status === 'CANCELLED' || status === 'TIMEOUT') {
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED,
            notes: `${order.notes || ''} | [Zomato Event]: ${status} (${reason})`,
          },
        });
      }

      void this.notificationsService.createNotification({
        recipientRole: 'FRANCHISE_OWNER',
        outletId: order.outletId,
        title: `⚠️ Zomato Order #${orderId} ${status}`,
        message: `Reason: ${reason}`,
        type: status === 'REJECTED' || status === 'CANCELLED' ? 'WARNING' : 'INFO',
      });
    }

    return { status: 'success', message: `Order status for ${orderId} updated to ${status}` };
  }

  /**
   * Zomato Delivery Partner Status Update Webhook
   * Doc: /online-ordering/v1/delivery-partner-status/webhook
   */
  async handleZomatoRiderStatusUpdate(payload: any) {
    const orderId = payload?.order_id || payload?.order?.details?.order_id || 'UNKNOWN';
    const riderName = payload?.rider_details?.name || payload?.delivery_partner?.name || 'Zomato Delivery Partner';
    const riderPhone = payload?.rider_details?.phone || payload?.delivery_partner?.phone || '';
    const riderStatus = payload?.rider_status || payload?.status || 'ASSIGNED'; // ASSIGNED, ARRIVED_AT_STORE, PICKED_UP

    const order = await this.prisma.order.findFirst({
      where: { notes: { contains: orderId } },
    });

    if (order) {
      void this.notificationsService.createNotification({
        recipientRole: 'FRANCHISE_OWNER',
        outletId: order.outletId,
        title: `🛵 Zomato Rider: ${riderStatus.replace(/_/g, ' ')}`,
        message: `Order #${orderId} - Rider ${riderName} ${riderPhone ? '(' + riderPhone + ')' : ''}`,
        type: 'INFO',
      });
    }

    return { status: 'success', message: `Rider update for order ${orderId} recorded` };
  }

  /**
   * Zomato Merchant Agreed Cancellation (MAC) Relay Webhook
   * Doc: /online-ordering/v1/mac/webhook
   */
  async handleZomatoCancellation(payload: any) {
    const orderId = payload?.order_id || payload?.order?.details?.order_id || 'UNKNOWN';
    const cancellationReason = payload?.reason || payload?.cancellation_reason || 'Customer requested cancellation';

    const order = await this.prisma.order.findFirst({
      where: { notes: { contains: orderId } },
    });

    if (order) {
      void this.notificationsService.createNotification({
        recipientRole: 'FRANCHISE_OWNER',
        outletId: order.outletId,
        title: `🚨 Zomato Cancellation Request (MAC)`,
        message: `Order #${orderId}: ${cancellationReason}`,
        type: 'WARNING',
      });
    }

    return { status: 'success', message: `Cancellation event for order ${orderId} received` };
  }

  /**
   * Zomato Complaints Webhook
   */
  async handleZomatoComplaint(payload: any) {
    const orderId = payload?.order_id || 'UNKNOWN';
    const complaintDetails = payload?.complaint?.description || payload?.message || 'Customer complaint registered on Zomato';

    const order = await this.prisma.order.findFirst({
      where: { notes: { contains: orderId } },
    });

    if (order) {
      void this.notificationsService.createNotification({
        recipientRole: 'FRANCHISE_OWNER',
        outletId: order.outletId,
        title: `⚠️ Zomato Customer Complaint`,
        message: `Order #${orderId}: ${complaintDetails}`,
        type: 'WARNING',
      });
    }

    return { status: 'success', message: 'Complaint recorded' };
  }

  /**
   * Zomato Order Ratings Webhook
   */
  async handleZomatoRating(payload: any) {
    const orderId = payload?.order_id || 'UNKNOWN';
    const rating = payload?.rating || payload?.stars || 5;
    const review = payload?.review || payload?.comment || '';

    const order = await this.prisma.order.findFirst({
      where: { notes: { contains: orderId } },
    });

    if (order) {
      void this.notificationsService.createNotification({
        recipientRole: 'FRANCHISE_OWNER',
        outletId: order.outletId,
        title: `⭐ New Zomato Rating: ${rating}/5`,
        message: review ? `"${review}"` : `Customer rated Order #${orderId}`,
        type: rating >= 4 ? 'SUCCESS' : 'WARNING',
      });
    }

    return { status: 'success', message: 'Rating recorded' };
  }

  /**
   * Helper to trigger Zomato "Mark Ready" API when kitchen marks order ready
   */
  async notifyZomatoOrderReady(orderId: string) {
    return this.zomatoService.markOrderReady(orderId);
  }

  // ─── Business Day Status ─────────────────────────────────────────────────────

  async currentDay(session: PosSession) {
    const day = await this.prisma.outletBusinessDay.findFirst({
      where: { outletId: session.outletId, status: BusinessDayStatus.OPEN },
      orderBy: { startedAt: 'desc' },
      include: {
        _count: { select: { bills: true } },
      },
    });

    if (!day) return { active: false, businessDay: null };

    // Auto-close days that have been open for more than 30 hours
    const hoursOpen = (Date.now() - day.startedAt.getTime()) / (1000 * 60 * 60);
    if (hoursOpen > 30) {
      await this.prisma.outletBusinessDay.update({
        where: { id: day.id },
        data: { status: BusinessDayStatus.CLOSED, endedAt: new Date() },
      });
      return { active: false, businessDay: null, autoClosedAt: new Date() };
    }

    return { active: true, businessDay: day };
  }

  // ─────────────────────────────────────────────────────────────────────────────

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
