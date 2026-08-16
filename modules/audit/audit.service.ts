import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@app/database';

import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

export type CreateAuditLogInput = {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  createLog(input: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
      },
    });
  }

  findMany(filters: ListAuditLogsDto) {
    return this.prisma.auditLog.findMany({
      where: {
        actorId: filters.actorId,
        action: filters.action,
        entityType: filters.entityType,
        entityId: filters.entityId,
        createdAt: this.createdAtFilter(filters),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
      },
    });
  }

  private createdAtFilter(filters: ListAuditLogsDto) {
    if (!filters.from && !filters.to) {
      return undefined;
    }

    return {
      gte: filters.from ? new Date(filters.from) : undefined,
      lte: filters.to ? new Date(filters.to) : undefined,
    };
  }
}
