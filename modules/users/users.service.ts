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
      countryCode: dto.countryCode || '+91',
      passwordHash,
      role: dto.role as unknown as PrismaUserRole,
      twoFactorEnabled: false,
      salaryAmount:
        dto.salaryAmount !== undefined
          ? new Prisma.Decimal(dto.salaryAmount)
          : undefined,
      salaryFrequency: dto.salaryFrequency || 'MONTHLY',
      salaryPayDay: dto.salaryPayDay || 5,
      salaryPaymentMethod: dto.salaryPaymentMethod || 'BANK_TRANSFER',
      joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
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

  // --- SALARY & ATTENDANCE METHODS ---

  async updateSalaryDetails(
    userId: string,
    dto: {
      salaryAmount?: number;
      salaryFrequency?: string;
      salaryPayDay?: number;
      salaryPaymentMethod?: string;
      joiningDate?: string;
    },
    actorId?: string,
  ) {
    await this.findByIdOrFail(userId);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        salaryAmount:
          dto.salaryAmount === undefined
            ? undefined
            : new Prisma.Decimal(dto.salaryAmount),
        salaryFrequency: dto.salaryFrequency,
        salaryPayDay: dto.salaryPayDay,
        salaryPaymentMethod: dto.salaryPaymentMethod,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
      },
      select: this.usersRepository['safeSelect'](),
    });

    await this.auditService.createLog({
      actorId,
      action: 'USER_SALARY_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: { ...dto },
    });

    return updated;
  }

  async markAttendance(
    userId: string,
    dto: { date: string; status: string; note?: string },
    actorId?: string,
  ) {
    await this.findByIdOrFail(userId);

    const dateObj = new Date(dto.date);
    dateObj.setUTCHours(0, 0, 0, 0);

    const record = await this.prisma.staffAttendance.upsert({
      where: {
        userId_date: {
          userId,
          date: dateObj,
        },
      },
      create: {
        userId,
        date: dateObj,
        status: dto.status,
        note: dto.note,
        markedBy: actorId,
      },
      update: {
        status: dto.status,
        note: dto.note,
        markedBy: actorId,
      },
    });

    await this.auditService.createLog({
      actorId,
      action: 'STAFF_ATTENDANCE_MARKED',
      entityType: 'StaffAttendance',
      entityId: record.id,
      metadata: { userId, date: dto.date, status: dto.status },
    });

    return record;
  }

  async removeAttendance(userId: string, dateStr: string, actorId?: string) {
    const dateObj = new Date(dateStr);
    dateObj.setUTCHours(0, 0, 0, 0);

    await this.prisma.staffAttendance.deleteMany({
      where: {
        userId,
        date: dateObj,
      },
    });

    await this.auditService.createLog({
      actorId,
      action: 'STAFF_ATTENDANCE_REMOVED',
      entityType: 'StaffAttendance',
      entityId: userId,
      metadata: { userId, date: dateStr },
    });

    return { success: true };
  }

  async getStaffPayrollDetails(userId: string) {
    const user = await this.findByIdOrFail(userId);

    const now = new Date();
    const payDay = user.salaryPayDay || 1;

    // Calculate cycle dates
    let cycleStart = new Date(now.getFullYear(), now.getMonth(), payDay);
    let cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, payDay);

    if (now.getDate() < payDay) {
      cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, payDay);
      cycleEnd = new Date(now.getFullYear(), now.getMonth(), payDay);
    }

    const totalCycleDays = Math.max(
      1,
      Math.round((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 3600 * 24)),
    );

    // Fetch attendances in this cycle
    const attendances = await this.prisma.staffAttendance.findMany({
      where: {
        userId,
        date: {
          gte: cycleStart,
          lt: cycleEnd,
        },
      },
      orderBy: { date: 'asc' },
    });

    let totalAbsentDays = 0;
    attendances.forEach((att) => {
      if (att.status === 'ABSENT') {
        totalAbsentDays += 1;
      } else if (att.status === 'HALF_DAY') {
        totalAbsentDays += 0.5;
      }
    });

    const salaryAmount = user.salaryAmount ? Number(user.salaryAmount) : 0;
    const dailyRate = salaryAmount > 0 ? salaryAmount / totalCycleDays : 0;
    const deductionAmount = Math.round(dailyRate * totalAbsentDays);
    const netPayableSalary = Math.max(0, salaryAmount - deductionAmount);

    return {
      user,
      payrollCycle: {
        cycleStart: cycleStart.toISOString().split('T')[0],
        cycleEnd: cycleEnd.toISOString().split('T')[0],
        payDay,
        totalCycleDays,
        salaryAmount,
        dailyRate: Math.round(dailyRate),
        totalAbsentDays,
        deductionAmount,
        netPayableSalary,
      },
      attendances,
    };
  }

  async getSalaryReminders() {
    const now = new Date();
    const todayDay = now.getDate();
    const targetDays = [todayDay, todayDay + 1, todayDay + 2];

    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        salaryAmount: { not: null },
        salaryPayDay: { in: targetDays },
      },
      select: this.usersRepository['safeSelect'](),
    });

    return users.map((u) => {
      const payDay = u.salaryPayDay || 1;
      const daysLeft = payDay - todayDay;
      let statusLabel = 'Due Today';
      if (daysLeft === 1) statusLabel = 'Due Tomorrow';
      else if (daysLeft === 2) statusLabel = 'Due in 2 Days';

      return {
        ...u,
        dueStatus: statusLabel,
        daysLeft,
      };
    });
  }

  async getPayrollSummary(franchiseId?: string) {
    const whereCondition: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      salaryAmount: { not: null },
    };

    if (franchiseId) {
      whereCondition.franchiseId = franchiseId;
    }

    const users = await this.prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        salaryAmount: true,
        franchiseId: true,
        outletId: true,
      },
    });

    const totalStaffWithSalary = users.length;
    const totalMonthlyPayroll = users.reduce(
      (sum, u) => sum + (u.salaryAmount ? Number(u.salaryAmount) : 0),
      0,
    );

    return {
      totalStaffWithSalary,
      totalMonthlyPayroll,
    };
  }
}
