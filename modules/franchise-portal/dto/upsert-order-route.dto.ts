import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderSource } from '@prisma/client';

export class UpsertOrderRouteDto {
  @IsString()
  outletId!: string;

  @IsEnum(OrderSource)
  source!: OrderSource;

  @IsString()
  posDeviceId!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
