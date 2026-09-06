import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { CreateFranchiseDto } from './dto/create-franchise.dto';
import { UpdateFranchiseStatusDto } from './dto/update-franchise-status.dto';
import { UpdateFranchiseDto } from './dto/update-franchise.dto';
import { FranchisesRepository } from './franchises.repository';

@Injectable()
export class FranchisesService {
  constructor(
    private readonly franchisesRepository: FranchisesRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateFranchiseDto, actorId?: string) {
    const franchise = await this.franchisesRepository.create(dto);

    await this.auditService.createLog({
      actorId,
      action: 'FRANCHISE_CREATED',
      entityType: 'Franchise',
      entityId: franchise.id,
      metadata: { name: franchise.name },
    });

    return franchise;
  }

  findMany() {
    return this.franchisesRepository.findMany();
  }

  async findByIdOrFail(id: string) {
    const franchise = await this.franchisesRepository.findById(id);

    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }

    return franchise;
  }

  async findDetailByIdOrFail(id: string, range = "1m") {
    const franchise = await this.franchisesRepository.findDetailById(id, range);

    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }

    return franchise;
  }

  async update(id: string, dto: UpdateFranchiseDto, actorId?: string) {
    await this.findByIdOrFail(id);
    const franchise = await this.franchisesRepository.update(id, dto);

    await this.auditService.createLog({
      actorId,
      action: 'FRANCHISE_UPDATED',
      entityType: 'Franchise',
      entityId: id,
      metadata: { ...dto },
    });

    return franchise;
  }

  async updateStatus(
    id: string,
    dto: UpdateFranchiseStatusDto,
    actorId?: string,
  ) {
    await this.findByIdOrFail(id);
    const franchise = await this.franchisesRepository.updateStatus(id, dto.isActive);

    await this.auditService.createLog({
      actorId,
      action: 'FRANCHISE_STATUS_UPDATED',
      entityType: 'Franchise',
      entityId: id,
      metadata: { isActive: dto.isActive },
    });

    return franchise;
  }
}
