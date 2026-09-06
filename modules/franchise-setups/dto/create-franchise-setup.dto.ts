import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class FranchiseSetupDetailsDto {
  @IsString()
  franchiseName!: string;

  @IsString()
  contactPersonName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  agreementStartDate?: string;

  @IsOptional()
  @IsString()
  agreementEndDate?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  securityDeposit?: string;

  @IsOptional()
  @IsString()
  royaltyPercent?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsBoolean()
  canManageMenu!: boolean;

  @IsBoolean()
  canManageOutletStaff!: boolean;

  @IsBoolean()
  canViewReports!: boolean;

  @IsBoolean()
  canRouteOrders!: boolean;

  @IsBoolean()
  canRequestExtraPos!: boolean;
}

class FranchiseSetupOutletDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  openingTime?: string;

  @IsOptional()
  @IsString()
  closingTime?: string;

  @IsBoolean()
  dineIn!: boolean;

  @IsBoolean()
  takeaway!: boolean;

  @IsBoolean()
  delivery!: boolean;

  @IsBoolean()
  onlineOrdering!: boolean;

  @IsBoolean()
  menuEdit!: boolean;

  @IsBoolean()
  billEdit!: boolean;

  @IsBoolean()
  reports!: boolean;

  @IsBoolean()
  orderRouting!: boolean;
}

class FranchiseSetupPosDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultPermanentPos!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  extraPermanentPos!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  extraPosMonthlyPrice?: number;

  @IsString()
  billingCycle!: string;
}

export class CreateFranchiseSetupDto {
  @ValidateNested()
  @Type(() => FranchiseSetupDetailsDto)
  franchise!: FranchiseSetupDetailsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FranchiseSetupOutletDto)
  outlets!: FranchiseSetupOutletDto[];

  @ValidateNested()
  @Type(() => FranchiseSetupPosDto)
  pos!: FranchiseSetupPosDto;
}
