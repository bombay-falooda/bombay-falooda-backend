import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PosDeviceStatus as PrismaPosDeviceStatus,
  PosDeviceType as PrismaPosDeviceType,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { PosDeviceStatus } from '@app/common';
import { PrismaService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import { CreatePosDeviceDto } from './dto/create-pos-device.dto';
import { UpdatePosDeviceStatusDto } from './dto/update-pos-device-status.dto';
import { UpdatePosDeviceDto } from './dto/update-pos-device.dto';
import { PosRepository } from './pos.repository';

@Injectable()
export class PosService {
  private readonly pinSaltRounds = 12;

  constructor(
    private readonly posRepository: PosRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePosDeviceDto, actorId?: string) {
    await this.ensureOutletExists(dto.outletId);
    const accessKey = dto.accessKey || (await this.generateAccessKey());

    if (dto.accessKey) {
      await this.ensureAccessKeyIsAvailable(dto.accessKey);
    }

    const posDevice = await this.posRepository.create(
      await this.toCreateInput(dto, accessKey),
    );

    await this.auditService.createLog({
      actorId,
      action: 'POS_DEVICE_CREATED',
      entityType: 'PosDevice',
      entityId: posDevice.id,
      metadata: {
        outletId: posDevice.outletId,
        name: posDevice.name,
        type: posDevice.type,
        status: posDevice.status,
        eventName: posDevice.eventName,
      },
    });

    return posDevice;
  }

  findMany() {
    return this.posRepository.findMany();
  }

  async findByIdOrFail(id: string) {
    const posDevice = await this.posRepository.findById(id);

    if (!posDevice) {
      throw new NotFoundException('POS device not found');
    }

    return posDevice;
  }

  async update(id: string, dto: UpdatePosDeviceDto, actorId?: string) {
    await this.findByIdOrFail(id);

    if (dto.outletId) {
      await this.ensureOutletExists(dto.outletId);
    }

    const posDevice = await this.posRepository.update(
      id,
      await this.toUpdateInput(dto),
    );

    await this.auditService.createLog({
      actorId,
      action: 'POS_DEVICE_UPDATED',
      entityType: 'PosDevice',
      entityId: id,
      metadata: this.redactSensitivePosMetadata(dto),
    });

    return posDevice;
  }

  async updateStatus(
    id: string,
    dto: UpdatePosDeviceStatusDto,
    actorId?: string,
  ) {
    await this.findByIdOrFail(id);
    const posDevice = await this.posRepository.updateStatus(
      id,
      dto.status as unknown as PrismaPosDeviceStatus,
    );

    await this.auditService.createLog({
      actorId,
      action: 'POS_DEVICE_STATUS_UPDATED',
      entityType: 'PosDevice',
      entityId: id,
      metadata: { status: dto.status },
    });

    return posDevice;
  }

  private async ensureOutletExists(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: { id: true },
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }
  }

  private async ensureAccessKeyIsAvailable(accessKey: string) {
    const posDevice = await this.posRepository.findByAccessKey(accessKey);

    if (posDevice) {
      throw new ConflictException('POS access key already exists');
    }
  }

  private async generateAccessKey() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const accessKey = `POS-${randomBytes(6).toString('hex').toUpperCase()}`;
      const existing = await this.posRepository.findByAccessKey(accessKey);

      if (!existing) {
        return accessKey;
      }
    }

    throw new ConflictException('Could not generate unique POS access key');
  }

  private async toCreateInput(
    dto: CreatePosDeviceDto,
    accessKey: string,
  ): Promise<Prisma.PosDeviceCreateInput> {
    return {
      name: dto.name,
      type: dto.type as unknown as PrismaPosDeviceType,
      status: dto.status
        ? (dto.status as unknown as PrismaPosDeviceStatus)
        : PrismaPosDeviceStatus.PENDING,
      accessKey,
      pinHash: dto.pin ? await bcrypt.hash(dto.pin, this.pinSaltRounds) : undefined,
      deviceCode: dto.deviceCode,
      eventName: dto.eventName,
      eventLocation: dto.eventLocation,
      handlerName: dto.handlerName,
      handlerPhone: dto.handlerPhone,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      outlet: { connect: { id: dto.outletId } },
    };
  }

  private async toUpdateInput(
    dto: UpdatePosDeviceDto,
  ): Promise<Prisma.PosDeviceUpdateInput> {
    return {
      name: dto.name,
      type: dto.type
        ? (dto.type as unknown as PrismaPosDeviceType)
        : undefined,
      status: dto.status
        ? (dto.status as unknown as PrismaPosDeviceStatus)
        : undefined,
      pinHash: dto.pin ? await bcrypt.hash(dto.pin, this.pinSaltRounds) : undefined,
      deviceCode: dto.deviceCode,
      eventName: dto.eventName,
      eventLocation: dto.eventLocation,
      handlerName: dto.handlerName,
      handlerPhone: dto.handlerPhone,
      validFrom:
        dto.validFrom === undefined
          ? undefined
          : dto.validFrom === null
            ? null
            : new Date(dto.validFrom),
      validUntil:
        dto.validUntil === undefined
          ? undefined
          : dto.validUntil === null
            ? null
            : new Date(dto.validUntil),
      outlet: dto.outletId ? { connect: { id: dto.outletId } } : undefined,
    };
  }

  private redactSensitivePosMetadata(dto: UpdatePosDeviceDto) {
    const { pin: _pin, ...metadata } = dto;

    return metadata;
  }
}
