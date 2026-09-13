import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OutletStatus as PrismaOutletStatus, Prisma } from '@prisma/client';

import { OutletStatus } from '@app/common';
import { PrismaService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletStatusDto } from './dto/update-outlet-status.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { OutletsRepository } from './outlets.repository';

@Injectable()
export class OutletsService {
  constructor(
    private readonly outletsRepository: OutletsRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateOutletDto, actorId?: string) {
    await this.ensureCodeIsAvailable(dto.code);
    await this.ensureFranchiseExists(dto.franchiseId);
    const outlet = await this.outletsRepository.create(this.toCreateInput(dto));

    await this.auditService.createLog({
      actorId,
      action: 'OUTLET_CREATED',
      entityType: 'Outlet',
      entityId: outlet.id,
      metadata: { name: outlet.name, code: outlet.code, franchiseId: outlet.franchiseId },
    });

    return outlet;
  }

  findMany() {
    return this.outletsRepository.findMany();
  }

  async findByIdOrFail(id: string) {
    const outlet = await this.outletsRepository.findById(id);

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    return outlet;
  }

  async update(id: string, dto: UpdateOutletDto, actorId?: string) {
    const outlet = await this.findByIdOrFail(id);

    if (dto.code && dto.code !== outlet.code) {
      await this.ensureCodeIsAvailable(dto.code);
    }

    if (dto.franchiseId) {
      await this.ensureFranchiseExists(dto.franchiseId);
    }

    const updatedOutlet = await this.outletsRepository.update(
      id,
      this.toUpdateInput(dto),
    );

    await this.auditService.createLog({
      actorId,
      action: 'OUTLET_UPDATED',
      entityType: 'Outlet',
      entityId: id,
      metadata: { ...dto },
    });

    return updatedOutlet;
  }

  async updateStatus(id: string, dto: UpdateOutletStatusDto, actorId?: string) {
    await this.findByIdOrFail(id);
    const outlet = await this.outletsRepository.updateStatus(
      id,
      dto.status as unknown as PrismaOutletStatus,
    );

    await this.auditService.createLog({
      actorId,
      action: 'OUTLET_STATUS_UPDATED',
      entityType: 'Outlet',
      entityId: id,
      metadata: { status: dto.status },
    });

    return outlet;
  }

  async getMenuCategories() {
    let categories = await this.prisma.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    if (categories.length === 0) {
      // Seed default categories
      const defaults = [
        { name: 'Falooda', sortOrder: 1 },
        { name: 'Specialty Faloodas', sortOrder: 2 },
        { name: 'Ice Creams', sortOrder: 3 },
        { name: 'Beverages', sortOrder: 4 },
      ];
      for (const d of defaults) {
        await this.prisma.menuCategory.create({ data: d });
      }
      categories = await this.prisma.menuCategory.findMany({
        orderBy: { sortOrder: 'asc' },
      });
    }

    return categories;
  }

  async createOutletMenuItem(
    outletId: string,
    dto: {
      name: string;
      description?: string;
      imageUrl?: string;
      price: number;
      categoryId?: string;
      categoryName?: string;
      subCategory?: string;
      isActive?: boolean;
      dineIn?: boolean;
      takeaway?: boolean;
      delivery?: boolean;
      targetOutletIds?: string[];
      targetFranchiseIds?: string[];
      addonGroups?: Array<{
        name: string;
        minSelect?: number;
        maxSelect?: number;
        isRequired?: boolean;
        addons?: Array<{ name: string; price: number }>;
      }>;
    },
    actorId?: string,
  ) {
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
      const defaultCat = (await this.getMenuCategories())[0];
      categoryId = defaultCat.id;
    }

    // Target Outlet IDs
    const targetOutletIdsSet = new Set<string>();
    if (outletId) targetOutletIdsSet.add(outletId);
    if (dto.targetOutletIds && dto.targetOutletIds.length > 0) {
      dto.targetOutletIds.forEach((id) => targetOutletIdsSet.add(id));
    }
    if (dto.targetFranchiseIds && dto.targetFranchiseIds.length > 0) {
      const outletsInFranchises = await this.prisma.outlet.findMany({
        where: { franchiseId: { in: dto.targetFranchiseIds } },
        select: { id: true },
      });
      outletsInFranchises.forEach((o) => targetOutletIdsSet.add(o.id));
    }

    const targetOutletIds = Array.from(targetOutletIdsSet);

    // Create MenuItem with optional addonGroups
    const menuItem = await this.prisma.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        basePrice: new Prisma.Decimal(dto.price),
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
    });

    // Create OutletMenuItem for each target outlet
    let firstOutletMenuItem = null;
    for (const tOutletId of targetOutletIds) {
      const created = await this.prisma.outletMenuItem.upsert({
        where: {
          outletId_itemId: {
            outletId: tOutletId,
            itemId: menuItem.id,
          },
        },
        update: {
          price: new Prisma.Decimal(dto.price),
          isActive: dto.isActive ?? true,
          dineIn: dto.dineIn ?? true,
          takeaway: dto.takeaway ?? true,
          delivery: dto.delivery ?? true,
        },
        create: {
          outletId: tOutletId,
          itemId: menuItem.id,
          price: new Prisma.Decimal(dto.price),
          isActive: dto.isActive ?? true,
          dineIn: dto.dineIn ?? true,
          takeaway: dto.takeaway ?? true,
          delivery: dto.delivery ?? true,
        },
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
      });
      if (!firstOutletMenuItem) firstOutletMenuItem = created;
    }

    await this.auditService.createLog({
      actorId,
      action: 'OUTLET_MENU_ITEM_CREATED',
      entityType: 'OutletMenuItem',
      entityId: menuItem.id,
      metadata: { targetOutletsCount: targetOutletIds.length, itemName: dto.name, price: dto.price },
    });

    return firstOutletMenuItem;
  }

  async copyMenuFromOutlet(
    targetOutletId: string,
    sourceOutletId: string,
    actorId?: string,
  ) {
    await this.findByIdOrFail(targetOutletId);
    await this.findByIdOrFail(sourceOutletId);

    const sourceItems = await this.prisma.outletMenuItem.findMany({
      where: { outletId: sourceOutletId },
      include: {
        item: true,
      },
    });

    let copiedCount = 0;
    for (const sourceItem of sourceItems) {
      await this.prisma.outletMenuItem.upsert({
        where: {
          outletId_itemId: {
            outletId: targetOutletId,
            itemId: sourceItem.itemId,
          },
        },
        update: {
          price: sourceItem.price,
          isActive: sourceItem.isActive,
          dineIn: sourceItem.dineIn,
          takeaway: sourceItem.takeaway,
          delivery: sourceItem.delivery,
        },
        create: {
          outletId: targetOutletId,
          itemId: sourceItem.itemId,
          price: sourceItem.price,
          isActive: sourceItem.isActive,
          dineIn: sourceItem.dineIn,
          takeaway: sourceItem.takeaway,
          delivery: sourceItem.delivery,
        },
      });
      copiedCount++;
    }

    await this.auditService.createLog({
      actorId,
      action: 'OUTLET_MENU_COPIED',
      entityType: 'Outlet',
      entityId: targetOutletId,
      metadata: { sourceOutletId, copiedCount },
    });

    return { success: true, copiedCount };
  }

  async updateOutletMenuItem(
    outletId: string,
    outletMenuItemId: string,
    dto: {
      price?: number;
      isActive?: boolean;
      dineIn?: boolean;
      takeaway?: boolean;
      delivery?: boolean;
    },
    actorId?: string,
  ) {
    const existing = await this.prisma.outletMenuItem.findFirst({
      where: { id: outletMenuItemId, outletId },
    });

    if (!existing) {
      throw new NotFoundException('Outlet menu item not found');
    }

    const updated = await this.prisma.outletMenuItem.update({
      where: { id: outletMenuItemId },
      data: {
        price: dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
        isActive: dto.isActive,
        dineIn: dto.dineIn,
        takeaway: dto.takeaway,
        delivery: dto.delivery,
      },
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
    });

    await this.auditService.createLog({
      actorId,
      action: 'OUTLET_MENU_ITEM_UPDATED',
      entityType: 'OutletMenuItem',
      entityId: outletMenuItemId,
      metadata: { ...dto },
    });

    return updated;
  }

  async deleteOutletMenuItem(
    outletId: string,
    outletMenuItemId: string,
    actorId?: string,
  ) {
    const existing = await this.prisma.outletMenuItem.findFirst({
      where: { id: outletMenuItemId, outletId },
    });

    if (!existing) {
      throw new NotFoundException('Outlet menu item not found');
    }

    await this.prisma.outletMenuItem.delete({
      where: { id: outletMenuItemId },
    });

    await this.auditService.createLog({
      actorId,
      action: 'OUTLET_MENU_ITEM_DELETED',
      entityType: 'OutletMenuItem',
      entityId: outletMenuItemId,
      metadata: { outletId, itemId: existing.itemId },
    });

    return { success: true };
  }

  private async ensureCodeIsAvailable(code: string) {
    const outlet = await this.outletsRepository.findByCode(code);

    if (outlet) {
      throw new ConflictException('Outlet code already exists');
    }
  }

  private async ensureFranchiseExists(franchiseId?: string | null) {
    if (!franchiseId) {
      return;
    }

    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
      select: { id: true },
    });

    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }
  }

  private toCreateInput(dto: CreateOutletDto): Prisma.OutletCreateInput {
    return {
      name: dto.name,
      code: dto.code,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      phone: dto.phone,
      email: dto.email,
      latitude: dto.latitude,
      longitude: dto.longitude,
      dineIn: dto.dineIn,
      takeaway: dto.takeaway,
      delivery: dto.delivery,
      onlineOrderingEnabled: dto.onlineOrderingEnabled,
      serviceRadiusKm: dto.serviceRadiusKm,
      deliveryKmPricing: dto.deliveryKmPricing
        ? (dto.deliveryKmPricing as unknown as Prisma.InputJsonValue)
        : undefined,
      openingTime: dto.openingTime,
      closingTime: dto.closingTime,
      zomatoResId: dto.zomatoResId,
      swiggyResId: dto.swiggyResId,
      ezcaterStoreId: dto.ezcaterStoreId,
      urbanpiperStoreId: dto.urbanpiperStoreId,
      franchise: dto.franchiseId
        ? { connect: { id: dto.franchiseId } }
        : undefined,
    } as any;
  }

  private toUpdateInput(dto: UpdateOutletDto): Prisma.OutletUpdateInput {
    return {
      name: dto.name,
      code: dto.code,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      phone: dto.phone,
      email: dto.email,
      latitude: dto.latitude,
      longitude: dto.longitude,
      dineIn: dto.dineIn,
      takeaway: dto.takeaway,
      delivery: dto.delivery,
      onlineOrderingEnabled: dto.onlineOrderingEnabled,
      serviceRadiusKm: dto.serviceRadiusKm,
      deliveryKmPricing:
        dto.deliveryKmPricing === undefined
          ? undefined
          : dto.deliveryKmPricing === null
            ? Prisma.DbNull
            : (dto.deliveryKmPricing as unknown as Prisma.InputJsonValue),
      openingTime: dto.openingTime,
      closingTime: dto.closingTime,
      zomatoResId: dto.zomatoResId,
      swiggyResId: dto.swiggyResId,
      ezcaterStoreId: dto.ezcaterStoreId,
      urbanpiperStoreId: dto.urbanpiperStoreId,
      franchise:
        dto.franchiseId === undefined
          ? undefined
          : dto.franchiseId === null
            ? { disconnect: true }
            : { connect: { id: dto.franchiseId } },
    } as any;
  }
}
