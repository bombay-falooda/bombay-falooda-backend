import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderType } from '@prisma/client';

class WebsiteOrderAddonDto {
  @IsString()
  @IsNotEmpty()
  addonId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}

class WebsiteOrderItemDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebsiteOrderAddonDto)
  @IsOptional()
  addons?: WebsiteOrderAddonDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateWebsiteOrderDto {
  @IsString()
  @IsNotEmpty()
  outletId!: string;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  customerDistanceKm?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebsiteOrderItemDto)
  items!: WebsiteOrderItemDto[];
}
