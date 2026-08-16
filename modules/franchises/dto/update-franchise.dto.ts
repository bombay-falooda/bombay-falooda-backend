import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateFranchiseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

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

  @IsOptional()
  @IsBoolean()
  canManageMenu?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageOutletStaff?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewReports?: boolean;

  @IsOptional()
  @IsBoolean()
  canRouteOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  canRequestExtraPos?: boolean;
}
