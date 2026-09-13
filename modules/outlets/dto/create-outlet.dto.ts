import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateOutletDto {
  @IsOptional()
  @IsString()
  franchiseId?: string;

  @IsString()
  name!: string;

  @IsString()
  code!: string;

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
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  latitude?: string;

  @IsOptional()
  @IsString()
  longitude?: string;

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
  serviceRadiusKm?: string;

  @IsOptional()
  @IsString()
  openingTime?: string;

  @IsOptional()
  @IsString()
  closingTime?: string;

  @IsOptional()
  deliveryKmPricing?: Array<{ km: number; price: number }>;

  @IsOptional()
  @IsString()
  zomatoResId?: string;

  @IsOptional()
  @IsString()
  swiggyResId?: string;

  @IsOptional()
  @IsString()
  ezcaterStoreId?: string;

  @IsOptional()
  @IsString()
  urbanpiperStoreId?: string;
}
