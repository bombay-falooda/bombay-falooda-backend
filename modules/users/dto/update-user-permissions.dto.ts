import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserPermissionsDto {
  @IsOptional()
  @IsString()
  outletId?: string | null;

  @IsOptional()
  @IsString()
  posDeviceId?: string | null;

  @IsOptional()
  @IsBoolean()
  canEditMenu?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditBill?: boolean;

  @IsOptional()
  @IsBoolean()
  canCancelBill?: boolean;

  @IsOptional()
  @IsBoolean()
  canApplyDiscount?: boolean;

  @IsOptional()
  @IsBoolean()
  canReprintBill?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewReports?: boolean;

  @IsOptional()
  @IsBoolean()
  canRouteOrders?: boolean;
}
