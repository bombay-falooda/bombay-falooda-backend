import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateOutletDto {
  @IsOptional()
  @IsString()
  franchiseId?: string | null;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

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
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  latitude?: string | null;

  @IsOptional()
  @IsString()
  longitude?: string | null;

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
  @IsString()
  serviceRadiusKm?: string | null;

  @IsOptional()
  @IsString()
  openingTime?: string | null;

  @IsOptional()
  @IsString()
  closingTime?: string | null;

  @IsOptional()
  deliveryKmPricing?: Array<{ km: number; price: number }> | null;
}
