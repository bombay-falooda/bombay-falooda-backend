import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillStatus,
  MenuSetupStatus,
  OrderSource,
  OutletStatus,
  PosDeviceStatus,
  PosDeviceType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { PrismaService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import { CreateMenuAddonDto } from './dto/create-menu-addon.dto';
import { CreateMenuAddonGroupDto } from './dto/create-menu-addon-group.dto';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { RequestPosDeviceDto } from './dto/request-pos-device.dto';
import { UpdateFranchiseProfileDto } from './dto/update-franchise-profile.dto';
import { UpdateMenuAddonDto } from './dto/update-menu-addon.dto';
import { UpdateMenuAddonGroupDto } from './dto/update-menu-addon-group.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateOutletMenuItemDto } from './dto/update-outlet-menu-item.dto';
import { UpdateOutletSettingsDto } from './dto/update-outlet-settings.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { UpsertOrderRouteDto } from './dto/upsert-order-route.dto';

@Injectable()
export class FranchisePortalService {
  private readonly passwordSaltRounds = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async dashboard(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);
    const today = this.startOfDay();
    const [outletCount, activeOutletCount, posCount, activePosCount, todayOrders, sales] =
      await Promise.all([
        this.prisma.outlet.count({ where: { franchiseId: id } }),
        this.prisma.outlet.count({
          where: { franchiseId: id, status: OutletStatus.ACTIVE },
        }),
        this.prisma.posDevice.count({
          where: { outlet: { franchiseId: id } },
        }),
        this.prisma.posDevice.count({
          where: { outlet: { franchiseId: id }, status: PosDeviceStatus.ACTIVE },
        }),
        this.prisma.order.count({
          where: { outlet: { franchiseId: id }, createdAt: { gte: today } },
        }),
        this.prisma.bill.aggregate({
          where: {
            outlet: { franchiseId: id },
            status: BillStatus.FINALIZED,
            createdAt: { gte: today },
          },
          _sum: { total: true },
        }),
      ]);

    return {
      outletCount,
      activeOutletCount,
      posCount,
      activePosCount,
      todayOrders,
      todaySales: this.formatInr(sales._sum.total),
      pendingAlerts: await this.pendingAlertsCount(id),
    };
  }

  async profile(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);
    return this.prisma.franchise.findUniqueOrThrow({
      where: { id },
      include: {
        _count: {
          select: {
            outlets: true,
            users: true,
          },
        },
      },
    });
  }

  async updateProfile(
    franchiseId: string | null | undefined,
    dto: UpdateFranchiseProfileDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    const franchise = await this.prisma.franchise.update({
      where: { id },
      data: dto,
    });

    await this.log(actorId, 'FRANCHISE_PROFILE_UPDATED', 'Franchise', id, dto);

    return franchise;
  }

  outlets(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);

    return this.prisma.outlet.findMany({
      where: { franchiseId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        email: true,
        status: true,
        dineIn: true,
        takeaway: true,
        delivery: true,
        onlineOrderingEnabled: true,
        serviceRadiusKm: true,
        outletBaseCharge: true,
        deliveryKmPricing: true,
        openingTime: true,
        closingTime: true,
        menuSetupStatus: true,
        _count: {
          select: {
            posDevices: true,
            users: true,
          },
        },
      },
    });
  }

  posDevices(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);

    return this.prisma.posDevice.findMany({
      where: { outlet: { franchiseId: id } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
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
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            status: true,
          },
        },
      },
    });
  }

  async requestPosDevice(
    franchiseId: string | null | undefined,
    dto: RequestPosDeviceDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canRequestExtraPos');
    await this.ensureOutletInFranchise(id, dto.outletId);
    const posDevice = await this.prisma.posDevice.create({
      data: {
        outletId: dto.outletId,
        name: dto.name,
        type: dto.type,
        status: PosDeviceStatus.PENDING,
        accessKey: await this.generateAccessKey(),
        eventName: dto.eventName,
        eventLocation: dto.eventLocation,
        handlerName: dto.handlerName,
        handlerPhone: dto.handlerPhone,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
      include: { outlet: true },
    });

    await this.log(actorId, 'FRANCHISE_POS_REQUESTED', 'PosDevice', posDevice.id, {
      outletId: dto.outletId,
      type: dto.type,
      monthlyPrice: dto.type === PosDeviceType.TEMPORARY ? 1000 : 1000,
    });

    return posDevice;
  }

  async updatePosStatus(
    franchiseId: string | null | undefined,
    posDeviceId: string,
    status: PosDeviceStatus,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canRequestExtraPos');
    await this.ensurePosInFranchise(id, posDeviceId);
    const posDevice = await this.prisma.posDevice.update({
      where: { id: posDeviceId },
      data: { status },
      include: { outlet: true },
    });

    await this.log(actorId, 'FRANCHISE_POS_STATUS_UPDATED', 'PosDevice', posDeviceId, {
      status,
    });

    return posDevice;
  }

  async posDeviceDetails(
    franchiseId: string | null | undefined,
    posDeviceId: string,
    range = 'all',
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.ensurePosInFranchise(id, posDeviceId);

    const device = await this.prisma.posDevice.findUnique({
      where: { id: posDeviceId },
      include: {
        outlet: {
          select: { id: true, name: true, code: true, address: true, phone: true },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('POS device not found');
    }

    const since = range !== 'all' ? this.dateFromRange(range) : undefined;
    const billWhere: Prisma.BillWhereInput = {
      posDeviceId,
      status: BillStatus.FINALIZED,
      createdAt: since ? { gte: since } : undefined,
    };

    const [salesAgg, bills, recentBills] = await Promise.all([
      this.prisma.bill.aggregate({
        where: billWhere,
        _sum: { total: true, subtotal: true, taxAmount: true, discount: true },
        _avg: { total: true },
        _count: true,
      }),
      this.prisma.bill.findMany({
        where: billWhere,
        include: {
          payments: true,
          order: { select: { type: true, source: true } },
          items: { select: { id: true, name: true, quantity: true, total: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bill.findMany({
        where: billWhere,
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          payments: { select: { method: true, amount: true } },
          order: { select: { type: true, source: true } },
          items: { select: { id: true, name: true, quantity: true } },
        },
      }),
    ]);

    const paymentBreakdown: Record<string, { count: number; total: number }> = {
      CASH: { count: 0, total: 0 },
      UPI: { count: 0, total: 0 },
      CARD: { count: 0, total: 0 },
      ONLINE: { count: 0, total: 0 },
      OTHER: { count: 0, total: 0 },
    };

    for (const b of bills) {
      if (b.payments && b.payments.length > 0) {
        for (const p of b.payments) {
          const m = p.method || 'CASH';
          if (!paymentBreakdown[m]) {
            paymentBreakdown[m] = { count: 0, total: 0 };
          }
          paymentBreakdown[m].count += 1;
          paymentBreakdown[m].total += Number(p.amount);
        }
      } else {
        paymentBreakdown.CASH.count += 1;
        paymentBreakdown.CASH.total += Number(b.total);
      }
    }

    const totalSales = Number(salesAgg._sum.total ?? 0);
    const billCount = salesAgg._count;
    const avgBillValue = Number(salesAgg._avg.total ?? 0);

    return {
      device,
      range,
      metrics: {
        totalSales,
        totalSalesFormatted: this.formatInr(totalSales),
        billCount,
        avgBillValue,
        avgBillValueFormatted: this.formatInr(avgBillValue),
        subtotal: Number(salesAgg._sum.subtotal ?? 0),
        taxAmount: Number(salesAgg._sum.taxAmount ?? 0),
        discount: Number(salesAgg._sum.discount ?? 0),
      },
      paymentBreakdown: Object.entries(paymentBreakdown).map(([method, data]) => ({
        method,
        count: data.count,
        total: data.total,
        totalFormatted: this.formatInr(data.total),
      })),
      recentBills: recentBills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        customerName: b.customerName || 'Walk-in Customer',
        customerPhone: b.customerPhone || '-',
        total: Number(b.total),
        totalFormatted: this.formatInr(Number(b.total)),
        orderType: b.order?.type || 'DINE_IN',
        orderSource: b.order?.source || 'POS',
        paymentMethod: b.payments?.[0]?.method || 'CASH',
        itemsCount: b.items.length,
        itemsSummary: b.items.map((i) => `${i.name} (x${i.quantity})`).join(', '),
        finalizedAt: b.finalizedAt || b.createdAt,
      })),
    };
  }

  team(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);
    return this.prisma.user.findMany({
      where: {
        franchiseId: id,
        role: { in: [UserRole.STAFF, UserRole.POS_USER, UserRole.FRANCHISE_OWNER] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        outletId: true,
        createdAt: true,
        outlet: { select: { id: true, name: true, code: true } },
        permissions: true,
      },
    });
  }

  async createTeamMember(
    franchiseId: string | null | undefined,
    dto: CreateTeamMemberDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageOutletStaff');
    this.ensureTeamRole(dto.role);

    if (dto.outletId) {
      await this.ensureOutletInFranchise(id, dto.outletId);
    }

    await this.ensureUserIdentityAvailable(dto.email, dto.phone);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        countryCode: dto.countryCode || '+91',
        passwordHash: await bcrypt.hash(dto.password, this.passwordSaltRounds),
        role: dto.role as UserRole,
        franchiseId: id,
        outletId: dto.outletId,
        address: dto.address,
        state: dto.state,
        city: dto.city,
        pincode: dto.pincode,
        twoFactorEnabled: false,
      } as any,
      include: { outlet: true, permissions: true },
    });

    if (dto.outletId) {
      await this.prisma.userPermission.create({
        data: {
          userId: user.id,
          outletId: dto.outletId,
          canEditMenu: dto.role === 'STAFF',
          canEditBill: true,
          canViewReports: dto.role === 'STAFF',
        },
      });
    }

    await this.log(actorId, 'FRANCHISE_TEAM_MEMBER_CREATED', 'User', user.id, {
      role: user.role,
      outletId: user.outletId,
    });

    return user;
  }

  async updateTeamMember(
    franchiseId: string | null | undefined,
    userId: string,
    dto: UpdateTeamMemberDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageOutletStaff');
    await this.ensureUserInFranchise(id, userId);

    if (dto.role) {
      this.ensureTeamRole(dto.role);
    }

    if (dto.outletId) {
      await this.ensureOutletInFranchise(id, dto.outletId);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        role: dto.role as UserRole | undefined,
        status: dto.status as UserStatus | undefined,
        outletId: dto.outletId,
        passwordHash: dto.password
          ? await bcrypt.hash(dto.password, this.passwordSaltRounds)
          : undefined,
      },
      include: { outlet: true, permissions: true },
    });

    await this.log(actorId, 'FRANCHISE_TEAM_MEMBER_UPDATED', 'User', userId, {
      ...dto,
      password: dto.password ? '[REDACTED]' : undefined,
    });

    return user;
  }

  async deactivateTeamMember(
    franchiseId: string | null | undefined,
    userId: string,
    actorId?: string,
  ) {
    return this.updateTeamMember(
      franchiseId,
      userId,
      { status: UserStatus.INACTIVE },
      actorId,
    );
  }

  menuCategories() {
    return this.prisma.menuCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
  }

  async createMenuCategory(
    franchiseId: string | null | undefined,
    dto: CreateMenuCategoryDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageMenu');
    const category = await this.prisma.menuCategory.create({ data: dto });
    await this.log(actorId, 'FRANCHISE_MENU_CATEGORY_CREATED', 'MenuCategory', category.id, dto);
    return category;
  }

  async updateMenuCategory(
    franchiseId: string | null | undefined,
    categoryId: string,
    dto: UpdateMenuCategoryDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageMenu');
    await this.ensureMenuCategoryExists(categoryId);
    const category = await this.prisma.menuCategory.update({
      where: { id: categoryId },
      data: dto,
    });
    await this.log(actorId, 'FRANCHISE_MENU_CATEGORY_UPDATED', 'MenuCategory', categoryId, dto);
    return category;
  }

  menuItems(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);
    return this.prisma.menuItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        addonGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { addons: { orderBy: { sortOrder: 'asc' } } },
        },
        outletMenuItems: {
          where: { outlet: { franchiseId: id } },
          include: { outlet: { select: { id: true, name: true, code: true } } },
        },
      },
    });
  }

  async createMenuItem(
    franchiseId: string | null | undefined,
    dto: CreateMenuItemDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageMenu');

    let categoryId = dto.categoryId;
    if (!categoryId && dto.categoryName) {
      let cat = await this.prisma.menuCategory.findFirst({
        where: { name: { equals: dto.categoryName, mode: 'insensitive' } },
      });
      if (!cat) {
        cat = await this.prisma.menuCategory.create({
          data: { name: dto.categoryName, sortOrder: 10 },
        });
      }
      categoryId = cat.id;
    }

    if (!categoryId) {
      let cat = await this.prisma.menuCategory.findFirst({
        orderBy: { sortOrder: 'asc' },
      });
      if (!cat) {
        cat = await this.prisma.menuCategory.create({
          data: { name: 'Falooda', sortOrder: 1 },
        });
      }
      categoryId = cat.id;
    }

    const item = await this.prisma.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        basePrice: new Prisma.Decimal(dto.basePrice),
        isActive: dto.isActive ?? true,
        categoryId,
        subCategory: dto.subCategory,
        addonGroups: dto.addonGroups && dto.addonGroups.length > 0 ? {
          create: dto.addonGroups.map((g) => ({
            name: g.name,
            minSelect: g.minSelect ?? 0,
            maxSelect: g.maxSelect ?? 1,
            isRequired: g.isRequired ?? false,
            addons: g.addons && g.addons.length > 0 ? {
              create: g.addons.map((a) => ({
                name: a.name,
                price: new Prisma.Decimal(a.price),
              })),
            } : undefined,
          })),
        } : undefined,
      },
      include: {
        category: true,
        addonGroups: { include: { addons: true } },
      },
    });
    await this.log(actorId, 'FRANCHISE_MENU_ITEM_CREATED', 'MenuItem', item.id, dto);
    return item;
  }

  async updateMenuItem(
    franchiseId: string | null | undefined,
    itemId: string,
    dto: UpdateMenuItemDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageMenu');
    await this.ensureMenuItemExists(itemId);

    let categoryId = dto.categoryId;
    if (!categoryId && dto.categoryName) {
      let cat = await this.prisma.menuCategory.findFirst({
        where: { name: { equals: dto.categoryName, mode: 'insensitive' } },
      });
      if (!cat) {
        cat = await this.prisma.menuCategory.create({
          data: { name: dto.categoryName, sortOrder: 10 },
        });
      }
      categoryId = cat.id;
    }

    if (categoryId) {
      await this.ensureMenuCategoryExists(categoryId);
    }

    const item = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        categoryId: categoryId || undefined,
        subCategory: dto.subCategory,
        isActive: dto.isActive,
        basePrice:
          dto.basePrice === undefined
            ? undefined
            : new Prisma.Decimal(dto.basePrice),
      },
      include: {
        category: true,
        addonGroups: { include: { addons: true } },
      },
    });
    await this.log(actorId, 'FRANCHISE_MENU_ITEM_UPDATED', 'MenuItem', itemId, dto);
    return item;
  }

  async updateOutletMenuItem(
    franchiseId: string | null | undefined,
    dto: UpdateOutletMenuItemDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageMenu');
    await this.ensureOutletInFranchise(id, dto.outletId);
    const item = await this.prisma.menuItem.findUnique({
      where: { id: dto.itemId },
      select: { id: true, basePrice: true },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    const outletMenuItem = await this.prisma.outletMenuItem.upsert({
      where: { outletId_itemId: { outletId: dto.outletId, itemId: dto.itemId } },
      create: {
        outletId: dto.outletId,
        itemId: dto.itemId,
        price: dto.price === undefined ? item.basePrice : new Prisma.Decimal(dto.price),
        isActive: dto.isActive ?? true,
      },
      update: {
        price: dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
        isActive: dto.isActive,
      },
      include: {
        outlet: true,
        item: { include: { category: true } },
      },
    });

    await this.log(
      actorId,
      'FRANCHISE_OUTLET_MENU_ITEM_UPDATED',
      'OutletMenuItem',
      outletMenuItem.id,
      dto,
    );

    return outletMenuItem;
  }

  async createMenuAddonGroup(
    franchiseId: string | null | undefined,
    dto: CreateMenuAddonGroupDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageMenu');
    await this.ensureMenuItemExists(dto.itemId);

    const group = await this.prisma.menuAddonGroup.create({
      data: dto,
      include: { addons: true, item: { select: { id: true, name: true } } },
    });

    await this.log(
      actorId,
      'FRANCHISE_MENU_ADDON_GROUP_CREATED',
      'MenuAddonGroup',
      group.id,
      dto,
    );

    return group;
  }

  async updateMenuAddonGroup(
    franchiseId: string | null | undefined,
    groupId: string,
    dto: UpdateMenuAddonGroupDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageMenu');
    await this.ensureMenuAddonGroupExists(groupId);

    const group = await this.prisma.menuAddonGroup.update({
      where: { id: groupId },
      data: dto,
      include: { addons: true, item: { select: { id: true, name: true } } },
    });

    await this.log(
      actorId,
      'FRANCHISE_MENU_ADDON_GROUP_UPDATED',
      'MenuAddonGroup',
      groupId,
      dto,
    );

    return group;
  }

  async createMenuAddon(
    franchiseId: string | null | undefined,
    dto: CreateMenuAddonDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageMenu');
    await this.ensureMenuAddonGroupExists(dto.groupId);

    const addon = await this.prisma.menuAddon.create({
      data: {
        ...dto,
        price: new Prisma.Decimal(dto.price),
      },
      include: { group: { select: { id: true, name: true, itemId: true } } },
    });

    await this.log(actorId, 'FRANCHISE_MENU_ADDON_CREATED', 'MenuAddon', addon.id, dto);

    return addon;
  }

  async updateMenuAddon(
    franchiseId: string | null | undefined,
    addonId: string,
    dto: UpdateMenuAddonDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageMenu');
    await this.ensureMenuAddonExists(addonId);

    const addon = await this.prisma.menuAddon.update({
      where: { id: addonId },
      data: {
        ...dto,
        price: dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
      },
      include: { group: { select: { id: true, name: true, itemId: true } } },
    });

    await this.log(actorId, 'FRANCHISE_MENU_ADDON_UPDATED', 'MenuAddon', addonId, dto);

    return addon;
  }

  orderRoutes(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);
    return this.prisma.orderRoute.findMany({
      where: { outlet: { franchiseId: id } },
      orderBy: { createdAt: 'desc' },
      include: {
        outlet: { select: { id: true, name: true, code: true } },
        posDevice: { select: { id: true, name: true, status: true, type: true } },
      },
    });
  }

  async upsertOrderRoute(
    franchiseId: string | null | undefined,
    dto: UpsertOrderRouteDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canRouteOrders');
    await this.ensureOutletInFranchise(id, dto.outletId);
    await this.ensurePosInFranchise(id, dto.posDeviceId);
    const route = await this.prisma.orderRoute.upsert({
      where: { outletId_source: { outletId: dto.outletId, source: dto.source } },
      create: {
        outletId: dto.outletId,
        source: dto.source as OrderSource,
        posDeviceId: dto.posDeviceId,
        isActive: dto.isActive ?? true,
      },
      update: {
        posDeviceId: dto.posDeviceId,
        isActive: dto.isActive,
      },
      include: {
        outlet: true,
        posDevice: true,
      },
    });
    await this.log(actorId, 'FRANCHISE_ORDER_ROUTE_UPSERTED', 'OrderRoute', route.id, dto);
    return route;
  }

  async updateOutletSettings(
    franchiseId: string | null | undefined,
    outletId: string,
    dto: UpdateOutletSettingsDto,
    actorId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canManageOutletStaff');
    await this.ensureOutletInFranchise(id, outletId);
    const {
      delivery: _deliveryControlledBySuperadmin,
      serviceRadiusKm,
      outletBaseCharge,
      deliveryKmPricing,
      ...settings
    } = dto;
    void _deliveryControlledBySuperadmin;
    const outlet = await this.prisma.outlet.update({
      where: { id: outletId },
      data: {
        ...settings,
        serviceRadiusKm:
          serviceRadiusKm === undefined
            ? undefined
            : new Prisma.Decimal(serviceRadiusKm),
        outletBaseCharge:
          outletBaseCharge === undefined
            ? undefined
            : new Prisma.Decimal(outletBaseCharge),
        deliveryKmPricing:
          deliveryKmPricing === undefined
            ? undefined
            : (deliveryKmPricing as unknown as Prisma.InputJsonValue),
      },
    });
    await this.log(actorId, 'FRANCHISE_OUTLET_SETTINGS_UPDATED', 'Outlet', outletId, dto);
    return outlet;
  }

  async reports(
    franchiseId?: string | null,
    range = 'month',
    outletId?: string,
    posDeviceId?: string,
  ) {
    const id = this.requireFranchiseId(franchiseId);
    await this.assertFranchisePermission(id, 'canViewReports');
    const since = this.dateFromRange(range);
    const billWhere: Prisma.BillWhereInput = {
      outlet: { franchiseId: id },
      status: BillStatus.FINALIZED,
      createdAt: { gte: since },
      outletId: outletId || undefined,
      posDeviceId: posDeviceId || undefined,
    };
    const orderWhere: Prisma.OrderWhereInput = {
      outlet: { franchiseId: id },
      createdAt: { gte: since },
      outletId: outletId || undefined,
      posDeviceId: posDeviceId || undefined,
    };

    const [sales, orders, outletPerformance, itemPerformance, posPerformance, chartBills] =
      await Promise.all([
        this.prisma.bill.aggregate({
          where: billWhere,
          _sum: { total: true },
          _avg: { total: true },
          _count: true,
        }),
        this.prisma.order.count({
          where: orderWhere,
        }),
        this.prisma.bill.groupBy({
          by: ['outletId'],
          where: billWhere,
          _sum: { total: true },
          _count: true,
          orderBy: { _sum: { total: 'desc' } },
          take: 10,
        }),
        this.prisma.billItem.groupBy({
          by: ['itemId', 'name'],
          where: {
            bill: {
              ...billWhere,
            },
          },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 10,
        }),
        this.prisma.bill.groupBy({
          by: ['posDeviceId'],
          where: billWhere,
          _sum: { total: true },
          _count: true,
          orderBy: { _sum: { total: 'desc' } },
          take: 10,
        }),
        this.prisma.bill.findMany({
          where: billWhere,
          select: { total: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    const [outlets, posDevices] = await Promise.all([
      this.prisma.outlet.findMany({
        where: { id: { in: outletPerformance.map((row) => row.outletId) } },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.posDevice.findMany({
        where: { id: { in: posPerformance.map((row) => row.posDeviceId) } },
        select: { id: true, name: true, outlet: { select: { name: true, code: true } } },
      }),
    ]);
    const outletById = new Map(outlets.map((outlet) => [outlet.id, outlet]));
    const posById = new Map(posDevices.map((pos) => [pos.id, pos]));

    return {
      range,
      outletId: outletId || null,
      posDeviceId: posDeviceId || null,
      grossSales: this.formatInr(sales._sum.total),
      grossSalesValue: Number(sales._sum.total ?? 0),
      orderCount: orders,
      finalizedBills: sales._count,
      averageOrderValue: this.formatInr(sales._avg.total),
      averageOrderValueValue: Number(sales._avg.total ?? 0),
      chartSeries: this.chartSeries(chartBills, range),
      outletPerformance: outletPerformance.map((row) => ({
        ...row,
        outlet: outletById.get(row.outletId) ?? null,
      })),
      itemPerformance,
      posPerformance: posPerformance.map((row) => ({
        ...row,
        posDevice: posById.get(row.posDeviceId) ?? null,
      })),
    };
  }

  async alerts(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);
    const [inactivePos, inactiveOutlets, menuDrafts] = await Promise.all([
      this.prisma.posDevice.findMany({
        where: {
          outlet: { franchiseId: id },
          status: { in: [PosDeviceStatus.INACTIVE, PosDeviceStatus.EXPIRED] },
        },
        include: { outlet: { select: { name: true, code: true } } },
      }),
      this.prisma.outlet.findMany({
        where: { franchiseId: id, status: OutletStatus.INACTIVE },
      }),
      this.prisma.outlet.findMany({
        where: {
          franchiseId: id,
          menuSetupStatus: { not: MenuSetupStatus.PUBLISHED },
        },
      }),
    ]);

    return [
      ...inactivePos.map((device) => ({
        id: `pos-${device.id}`,
        type: 'POS',
        title: `${device.name} is ${device.status}`,
        message: `${device.outlet.name} (${device.outlet.code}) needs POS attention.`,
      })),
      ...inactiveOutlets.map((outlet) => ({
        id: `outlet-${outlet.id}`,
        type: 'OUTLET',
        title: `${outlet.name} is inactive`,
        message: 'This outlet is not accepting operations.',
      })),
      ...menuDrafts.map((outlet) => ({
        id: `menu-${outlet.id}`,
        type: 'MENU',
        title: `${outlet.name} menu is not published`,
        message: 'Complete outlet menu availability before online orders go live.',
      })),
    ];
  }

  auditLogs(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);
    return this.prisma.auditLog.findMany({
      where: {
        actor: { franchiseId: id },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  permissions(franchiseId?: string | null) {
    const id = this.requireFranchiseId(franchiseId);
    return this.prisma.franchise.findUniqueOrThrow({
      where: { id },
      select: {
        canManageMenu: true,
        canManageOutletStaff: true,
        canViewReports: true,
        canRouteOrders: true,
        canRequestExtraPos: true,
      },
    });
  }

  private requireFranchiseId(franchiseId?: string | null) {
    if (!franchiseId) {
      throw new ForbiddenException('Franchise owner is not assigned to a franchise');
    }

    return franchiseId;
  }

  private async ensureOutletInFranchise(franchiseId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, franchiseId },
      select: { id: true },
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found in your franchise');
    }
  }

  private async ensurePosInFranchise(franchiseId: string, posDeviceId: string) {
    const posDevice = await this.prisma.posDevice.findFirst({
      where: { id: posDeviceId, outlet: { franchiseId } },
      select: { id: true },
    });

    if (!posDevice) {
      throw new NotFoundException('POS device not found in your franchise');
    }
  }

  private async ensureUserInFranchise(franchiseId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, franchiseId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Team member not found in your franchise');
    }

    if (user.role === UserRole.SUPERADMIN) {
      throw new ForbiddenException('Cannot manage superadmin users');
    }
  }

  private ensureTeamRole(role: string) {
    if (role !== UserRole.STAFF && role !== UserRole.POS_USER) {
      throw new BadRequestException('Franchise can create only staff or POS users');
    }
  }

  private async ensureUserIdentityAvailable(email?: string, phone?: string) {
    if (!email && !phone) {
      throw new BadRequestException('Email or phone is required');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('User with this email or phone already exists');
    }
  }

  private async ensureMenuCategoryExists(categoryId: string) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Menu category not found');
    }
  }

  private async ensureMenuItemExists(itemId: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
  }

  private async ensureMenuAddonGroupExists(groupId: string) {
    const group = await this.prisma.menuAddonGroup.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      throw new NotFoundException('Menu add-on group not found');
    }
  }

  private async ensureMenuAddonExists(addonId: string) {
    const addon = await this.prisma.menuAddon.findUnique({
      where: { id: addonId },
      select: { id: true },
    });

    if (!addon) {
      throw new NotFoundException('Menu add-on not found');
    }
  }

  private async assertFranchisePermission(
    franchiseId: string,
    permission:
      | 'canManageMenu'
      | 'canManageOutletStaff'
      | 'canViewReports'
      | 'canRouteOrders'
      | 'canRequestExtraPos',
  ) {
    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      select: {
        canManageMenu: true,
        canManageOutletStaff: true,
        canViewReports: true,
        canRouteOrders: true,
        canRequestExtraPos: true,
      },
    });

    if (!franchise?.[permission]) {
      throw new ForbiddenException('This franchise permission is disabled');
    }
  }

  private async generateAccessKey() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const accessKey = `POS-${randomBytes(6).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.posDevice.findUnique({
        where: { accessKey },
        select: { id: true },
      });

      if (!existing) {
        return accessKey;
      }
    }

    throw new ConflictException('Could not generate unique POS access key');
  }

  private async pendingAlertsCount(franchiseId: string) {
    const [inactivePos, inactiveOutlets, menuDrafts] = await Promise.all([
      this.prisma.posDevice.count({
        where: {
          outlet: { franchiseId },
          status: { in: [PosDeviceStatus.INACTIVE, PosDeviceStatus.EXPIRED] },
        },
      }),
      this.prisma.outlet.count({
        where: { franchiseId, status: OutletStatus.INACTIVE },
      }),
      this.prisma.outlet.count({
        where: { franchiseId, menuSetupStatus: { not: MenuSetupStatus.PUBLISHED } },
      }),
    ]);

    return inactivePos + inactiveOutlets + menuDrafts;
  }

  private startOfDay() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private dateFromRange(range: string) {
    const date = new Date();

    if (range === 'hour') {
      date.setHours(date.getHours() - 1);
      return date;
    }

    if (range === '4hours') {
      date.setHours(date.getHours() - 4);
      return date;
    }

    if (range === 'day') {
      date.setHours(0, 0, 0, 0);
      return date;
    }

    if (range === 'week') {
      date.setDate(date.getDate() - 7);
      return date;
    }

    date.setDate(date.getDate() - 30);
    return date;
  }

  private chartSeries(
    bills: Array<{ total: Prisma.Decimal; createdAt: Date }>,
    range: string,
  ) {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      hour: range === 'hour' || range === '4hours' ? '2-digit' : undefined,
      day: range === 'hour' || range === '4hours' ? undefined : '2-digit',
      month: range === 'hour' || range === '4hours' ? undefined : 'short',
    });
    const buckets = new Map<string, { label: string; sales: number; bills: number }>();

    for (const bill of bills) {
      const label = formatter.format(bill.createdAt);
      const current = buckets.get(label) ?? { label, sales: 0, bills: 0 };
      current.sales += Number(bill.total);
      current.bills += 1;
      buckets.set(label, current);
    }

    return Array.from(buckets.values());
  }

  private formatInr(value: Prisma.Decimal | number | null | undefined) {
    const amount = Number(value ?? 0);
    return `INR ${amount.toLocaleString('en-IN', {
      maximumFractionDigits: 0,
    })}`;
  }

  private log(
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: unknown,
  ) {
    return this.auditService.createLog({
      actorId,
      action,
      entityType,
      entityId,
      metadata: this.toJson(metadata),
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
