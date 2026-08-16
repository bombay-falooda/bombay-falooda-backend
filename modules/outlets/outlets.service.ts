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
      openingTime: dto.openingTime,
      closingTime: dto.closingTime,
      franchise: dto.franchiseId
        ? { connect: { id: dto.franchiseId } }
        : undefined,
    };
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
      openingTime: dto.openingTime,
      closingTime: dto.closingTime,
      franchise:
        dto.franchiseId === undefined
          ? undefined
          : dto.franchiseId === null
            ? { disconnect: true }
            : { connect: { id: dto.franchiseId } },
    };
  }
}
