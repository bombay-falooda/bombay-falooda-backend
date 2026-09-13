import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OutletStatus } from '@prisma/client';

class DeliveryKmPricingDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  km!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;
}

export class UpdateOutletSettingsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(OutletStatus)
  status?: OutletStatus;

  @IsOptional()
  @IsBoolean()
  dineIn?: boolean;

  @IsOptional()
  @IsBoolean()
  takeaway?: boolean;

  @IsOptional()
  @IsBoolean()
  delivery?: boolean;

  @IsOptional()
  @IsBoolean()
  onlineOrderingEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceRadiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outletBaseCharge?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryKmPricingDto)
  deliveryKmPricing?: DeliveryKmPricingDto[];

  @IsOptional()
  @IsString()
  openingTime?: string | null;

  @IsOptional()
  @IsString()
  closingTime?: string | null;

  @IsOptional()
  @IsString()
  zomatoResId?: string | null;

  @IsOptional()
  @IsString()
  swiggyResId?: string | null;

  @IsOptional()
  @IsString()
  ezcaterStoreId?: string | null;

  @IsOptional()
  @IsString()
  urbanpiperStoreId?: string | null;
}
