import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  PosDeviceStatus,
  PosDeviceType,
  Prisma,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { PrismaService } from '@app/database';

import { AuditService } from '../audit/audit.service';
import { CreateFranchiseSetupDto } from './dto/create-franchise-setup.dto';

type CreatedSetupOutlet = {
  id: string;
  franchiseId: string | null;
  name: string;
  code: string;
  address: string;
  phone: string | null;
  email: string | null;
};

type CreatedSetupPosDevice = {
  id: string;
  outletId: string;
  name: string;
  deviceCode: string | null;
  accessKey: string;
  type: PosDeviceType;
  status: PosDeviceStatus;
};

@Injectable()
export class FranchiseSetupsService {
  private readonly passwordSaltRounds = 12;
  private readonly posMonthlyPrice = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateFranchiseSetupDto, actorId?: string) {
    if (!dto.outlets.length) {
      throw new BadRequestException('At least one outlet is required');
    }

    if (!dto.franchise.email) {
      throw new BadRequestException('Owner email is required');
    }

    const ownerPhone = this.clean(dto.franchise.phone);

    await this.ensureOwnerContactIsAvailable(dto.franchise.email, ownerPhone);
    await this.ensureOutletCodesAreAvailable(dto.outlets.map((outlet) => outlet.code));

    const ownerPassword = this.generateOwnerPassword(dto.franchise.franchiseName);
    const ownerPasswordHash = await bcrypt.hash(
      ownerPassword,
      this.passwordSaltRounds,
    );
    const totalPos =
      Number(dto.pos.defaultPermanentPos || 1) +
      Number(dto.pos.extraPermanentPos || 0);
    const posPin = this.generatePosPin();
    const posPinHash = await bcrypt.hash(posPin, this.passwordSaltRounds);

    const result = await this.prisma.$transaction(async (tx) => {
      const franchise = await tx.franchise.create({
        data: {
          name: dto.franchise.franchiseName,
          ownerName: dto.franchise.contactPersonName,
          email: dto.franchise.email,
          phone: ownerPhone,
          address: this.clean(dto.franchise.address),
          city: this.clean(dto.franchise.city),
          state: this.clean(dto.franchise.state),
          pincode: this.clean(dto.franchise.pincode),
          agreementStartDate: this.clean(dto.franchise.agreementStartDate),
          agreementEndDate: this.clean(dto.franchise.agreementEndDate),
          gstNumber: this.clean(dto.franchise.gstNumber),
          securityDeposit: this.clean(dto.franchise.securityDeposit),
          royaltyPercent: this.clean(dto.franchise.royaltyPercent),
          notes: this.clean(dto.franchise.notes),
          canManageMenu: dto.franchise.canManageMenu,
          canManageOutletStaff: dto.franchise.canManageOutletStaff,
          canViewReports: dto.franchise.canViewReports,
          canRouteOrders: dto.franchise.canRouteOrders,
          canRequestExtraPos: dto.franchise.canRequestExtraPos,
        },
        select: {
          id: true,
          name: true,
          ownerName: true,
          email: true,
          phone: true,
        },
      });

      const owner = await tx.user.create({
        data: {
          name: dto.franchise.contactPersonName,
          email: dto.franchise.email,
          phone: ownerPhone,
          passwordHash: ownerPasswordHash,
          role: UserRole.FRANCHISE_OWNER,
          twoFactorEnabled: true,
          franchise: { connect: { id: franchise.id } },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      const createdOutlets: CreatedSetupOutlet[] = [];
      const createdPosDevices: CreatedSetupPosDevice[] = [];

      for (const outletDto of dto.outlets) {
        const outlet = await tx.outlet.create({
          data: {
            franchise: { connect: { id: franchise.id } },
            name: outletDto.name,
            code: outletDto.code,
            address: this.formatAddress(outletDto),
            phone: this.clean(outletDto.phone),
            email: this.clean(outletDto.email),
            openingTime: this.clean(outletDto.openingTime),
            closingTime: this.clean(outletDto.closingTime),
            dineIn: outletDto.dineIn,
            takeaway: outletDto.takeaway,
            delivery: outletDto.delivery,
            onlineOrderingEnabled: outletDto.onlineOrdering,
          },
          select: {
            id: true,
            franchiseId: true,
            name: true,
            code: true,
            address: true,
            phone: true,
            email: true,
          },
        });

        createdOutlets.push(outlet);

        for (let index = 0; index < totalPos; index += 1) {
          const accessKey = await this.generateAccessKey(tx);
          const posDevice = await tx.posDevice.create({
            data: {
              outlet: { connect: { id: outlet.id } },
              name:
                index === 0
                  ? `${outlet.name} Main POS`
                  : `${outlet.name} POS ${index + 1}`,
              type: PosDeviceType.PERMANENT,
              status: PosDeviceStatus.ACTIVE,
              accessKey,
              pinHash: posPinHash,
              deviceCode: `${outlet.code}-POS-${String(index + 1).padStart(2, '0')}`,
            },
            select: {
              id: true,
              outletId: true,
              name: true,
              deviceCode: true,
              accessKey: true,
              type: true,
              status: true,
            },
          });

          createdPosDevices.push(posDevice);
        }
      }

      return {
        franchise,
        owner,
        outlets: createdOutlets,
        posDevices: createdPosDevices,
      };
    });

    await this.auditService.createLog({
      actorId,
      action: 'FRANCHISE_SETUP_CREATED',
      entityType: 'Franchise',
      entityId: result.franchise.id,
      metadata: {
        franchiseId: result.franchise.id,
        outletCount: result.outlets.length,
        posCount: result.posDevices.length,
        extraPosMonthlyAmount:
          Number(dto.pos.extraPermanentPos || 0) * this.posMonthlyPrice,
      },
    });

    return {
      ...result,
      document: {
        ownerLogin: {
          email: dto.franchise.email,
          password: ownerPassword,
        },
        posLogin: {
          pin: posPin,
          keys: result.posDevices.map((device) => ({
            outletId: device.outletId,
            name: device.name,
            deviceCode: device.deviceCode,
            accessKey: device.accessKey,
          })),
        },
        billing: {
          defaultPermanentPos: Number(dto.pos.defaultPermanentPos || 1),
          extraPermanentPos: Number(dto.pos.extraPermanentPos || 0),
          extraPosMonthlyPrice: this.posMonthlyPrice,
          extraPosMonthlyAmount:
            Number(dto.pos.extraPermanentPos || 0) * this.posMonthlyPrice,
          billingCycle: dto.pos.billingCycle,
        },
      },
    };
  }

  private async ensureOwnerContactIsAvailable(email?: string, phone?: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          phone ? { phone } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Owner email or phone is already in use');
    }
  }

  private async ensureOutletCodesAreAvailable(codes: string[]) {
    const duplicateCodes = codes.filter(
      (code, index) => codes.indexOf(code) !== index,
    );

    if (duplicateCodes.length) {
      throw new ConflictException('Outlet codes must be unique');
    }

    const existingOutlet = await this.prisma.outlet.findFirst({
      where: { code: { in: codes } },
      select: { code: true },
    });

    if (existingOutlet) {
      throw new ConflictException(`Outlet code ${existingOutlet.code} already exists`);
    }
  }

  private formatAddress(outlet: {
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
  }) {
    return [outlet.address, outlet.city, outlet.state, outlet.pincode]
      .map((part) => this.clean(part))
      .filter(Boolean)
      .join(', ');
  }

  private clean(value?: string | null) {
    return value?.trim() || undefined;
  }

  private generateOwnerPassword(name: string) {
    const clean = name.replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'BF';
    return `${clean}@${new Date().getFullYear()}#01`;
  }

  private generatePosPin() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async generateAccessKey(tx: Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const accessKey = `POS-${randomBytes(6).toString('hex').toUpperCase()}`;
      const existing = await tx.posDevice.findUnique({
        where: { accessKey },
        select: { id: true },
      });

      if (!existing) {
        return accessKey;
      }
    }

    throw new ConflictException('Could not generate unique POS access key');
  }
}
