import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';

import { PrismaService } from '@app/database';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
      select: this.safeSelect(),
    });
  }

  findMany() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.safeSelect(),
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: this.safeSelect(),
    });
  }

  findByIdWithRole(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        franchiseId: true,
        outletId: true,
      },
    });
  }

  findAuthUserByEmailOrPhone(emailOrPhone: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
      },
    });
  }

  updateStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: this.safeSelect(),
    });
  }

  updateAssignment(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: this.safeSelect(),
    });
  }

  findPermissions(userId: string) {
    return this.prisma.userPermission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        posDevice: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
      },
    });
  }

  createPermission(data: Prisma.UserPermissionCreateInput) {
    return this.prisma.userPermission.create({
      data,
      include: this.permissionInclude(),
    });
  }

  findPermissionScope(
    userId: string,
    outletId: string | null,
    posDeviceId: string | null,
  ) {
    return this.prisma.userPermission.findFirst({
      where: {
        userId,
        outletId,
        posDeviceId,
      },
      select: { id: true },
    });
  }

  updatePermission(id: string, data: Prisma.UserPermissionUpdateInput) {
    return this.prisma.userPermission.update({
      where: { id },
      data,
      include: this.permissionInclude(),
    });
  }

  updateLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
      select: this.safeSelect(),
    });
  }

  private safeSelect() {
    return {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      franchiseId: true,
      outletId: true,
      twoFactorEnabled: true,
      twoFactorMethod: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UserSelect;
  }

  private permissionInclude() {
    return {
      outlet: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      posDevice: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
        },
      },
    } satisfies Prisma.UserPermissionInclude;
  }
}

export type SafeUser = Awaited<ReturnType<UsersRepository['findById']>>;
export { UserStatus };
