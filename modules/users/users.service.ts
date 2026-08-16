import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { UserRole, UserStatus } from '@app/common';
import { PrismaService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAssignmentDto } from './dto/update-user-assignment.dto';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  private readonly passwordSaltRounds = 12;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findMany() {
    return this.usersRepository.findMany();
  }

  async findByIdOrFail(id: string) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  findAuthUserByEmailOrPhone(emailOrPhone: string) {
    return this.usersRepository.findAuthUserByEmailOrPhone(emailOrPhone);
  }

  async create(dto: CreateUserDto, actorId?: string) {
    if (!dto.email && !dto.phone) {
      throw new ConflictException('Email or phone is required');
    }

    const existingEmail = dto.email
      ? await this.usersRepository.findAuthUserByEmailOrPhone(dto.email)
      : null;
    const existingPhone = dto.phone
      ? await this.usersRepository.findAuthUserByEmailOrPhone(dto.phone)
      : null;

    if (existingEmail || existingPhone) {
      throw new ConflictException('User with this email or phone already exists');
    }

    await this.validateRoleAssignment(dto.role, {
      franchiseId: dto.franchiseId,
      outletId: dto.outletId,
    });

    const passwordHash = await bcrypt.hash(dto.password, this.passwordSaltRounds);
    const user = await this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: dto.role as unknown as PrismaUserRole,
      twoFactorEnabled: false,
      franchise: dto.franchiseId
        ? { connect: { id: dto.franchiseId } }
        : undefined,
      outlet: dto.outletId ? { connect: { id: dto.outletId } } : undefined,
    });

    await this.auditService.createLog({
      actorId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        role: user.role,
        email: user.email,
        phone: user.phone,
        franchiseId: user.franchiseId,
        outletId: user.outletId,
      },
    });

    return user;
  }

  async updateStatus(id: string, status: UserStatus, actorId?: string) {
    const user = await this.usersRepository.updateStatus(
      id,
      status as unknown as PrismaUserStatus,
    );

    await this.auditService.createLog({
      actorId,
      action: 'USER_STATUS_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: { status },
    });

    return user;
  }

  updateLastLogin(id: string) {
    return this.usersRepository.updateLastLogin(id);
  }

  async updateAssignment(
    id: string,
    dto: UpdateUserAssignmentDto,
    actorId?: string,
  ) {
    const user = await this.usersRepository.findByIdWithRole(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const nextFranchiseId =
      dto.franchiseId === undefined ? user.franchiseId : dto.franchiseId;
    const nextOutletId = dto.outletId === undefined ? user.outletId : dto.outletId;

    await this.validateRoleAssignment(user.role as unknown as UserRole, {
      franchiseId: nextFranchiseId,
      outletId: nextOutletId,
    });

    const updatedUser = await this.usersRepository.updateAssignment(id, {
      franchise:
        dto.franchiseId === undefined
          ? undefined
          : dto.franchiseId === null
            ? { disconnect: true }
            : { connect: { id: dto.franchiseId } },
      outlet:
        dto.outletId === undefined
          ? undefined
          : dto.outletId === null
            ? { disconnect: true }
            : { connect: { id: dto.outletId } },
    });

    await this.auditService.createLog({
      actorId,
      action: 'USER_ASSIGNMENT_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: {
        franchiseId: updatedUser.franchiseId,
        outletId: updatedUser.outletId,
      },
    });

    return updatedUser;
  }

  async findPermissions(id: string) {
    await this.findByIdOrFail(id);

    return this.usersRepository.findPermissions(id);
  }

  async createPermission(
    id: string,
    dto: UpdateUserPermissionsDto,
    actorId?: string,
  ) {
    const user = await this.usersRepository.findByIdWithRole(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.validatePermissionTargets(dto);

    const permissionData = {
      canEditMenu: dto.canEditMenu ?? false,
      canEditBill: dto.canEditBill ?? false,
      canCancelBill: dto.canCancelBill ?? false,
      canApplyDiscount: dto.canApplyDiscount ?? false,
      canReprintBill: dto.canReprintBill ?? false,
      canViewReports: dto.canViewReports ?? false,
      canRouteOrders: dto.canRouteOrders ?? false,
    };
    const existingPermission = await this.usersRepository.findPermissionScope(
      id,
      dto.outletId ?? null,
      dto.posDeviceId ?? null,
    );

    if (existingPermission) {
      const permission = await this.usersRepository.updatePermission(
        existingPermission.id,
        permissionData,
      );

      await this.auditService.createLog({
        actorId,
        action: 'USER_PERMISSION_UPDATED',
        entityType: 'UserPermission',
        entityId: existingPermission.id,
        metadata: { userId: id, ...dto, ...permissionData },
      });

      return permission;
    }

    const permission = await this.usersRepository.createPermission({
      user: { connect: { id } },
      outlet: dto.outletId ? { connect: { id: dto.outletId } } : undefined,
      posDevice: dto.posDeviceId
        ? { connect: { id: dto.posDeviceId } }
        : undefined,
      ...permissionData,
    });

    await this.auditService.createLog({
      actorId,
      action: 'USER_PERMISSION_CREATED',
      entityType: 'UserPermission',
      entityId: permission.id,
      metadata: { userId: id, ...dto, ...permissionData },
    });

    return permission;
  }

  private async validateRoleAssignment(
    role: UserRole,
    assignment: { franchiseId?: string | null; outletId?: string | null },
  ) {
    if (role === UserRole.Superadmin) {
      if (assignment.franchiseId || assignment.outletId) {
        throw new BadRequestException(
          'Superadmin cannot be assigned to a franchise or outlet',
        );
      }

      return;
    }

    if (role === UserRole.FranchiseOwner && !assignment.franchiseId) {
      throw new BadRequestException('Franchise Owner must be assigned to a franchise');
    }

    if (role === UserRole.PosUser && !assignment.outletId) {
      throw new BadRequestException('POS User must be assigned to an outlet');
    }

    if (assignment.franchiseId) {
      await this.ensureFranchiseExists(assignment.franchiseId);
    }

    if (assignment.outletId) {
      await this.ensureOutletExists(assignment.outletId);
    }
  }

  private async validatePermissionTargets(dto: UpdateUserPermissionsDto) {
    if (dto.outletId) {
      await this.ensureOutletExists(dto.outletId);
    }

    if (dto.posDeviceId) {
      const posDevice = await this.prisma.posDevice.findUnique({
        where: { id: dto.posDeviceId },
        select: {
          id: true,
          outletId: true,
        },
      });

      if (!posDevice) {
        throw new NotFoundException('POS device not found');
      }

      if (dto.outletId && posDevice.outletId !== dto.outletId) {
        throw new BadRequestException('POS device does not belong to outlet');
      }
    }
  }

  private async ensureFranchiseExists(id: string) {
    const franchise = await this.prisma.franchise.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!franchise) {
      throw new NotFoundException('Franchise not found');
    }
  }

  private async ensureOutletExists(id: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }
  }
}
