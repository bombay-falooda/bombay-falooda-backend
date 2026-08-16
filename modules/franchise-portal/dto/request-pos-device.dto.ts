import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PosDeviceType } from '@prisma/client';

export class RequestPosDeviceDto {
  @IsString()
  outletId!: string;

  @IsString()
  name!: string;

  @IsEnum(PosDeviceType)
  type!: PosDeviceType;

  @IsOptional()
  @IsString()
  eventName?: string;

  @IsOptional()
  @IsString()
  eventLocation?: string;

  @IsOptional()
  @IsString()
  handlerName?: string;

  @IsOptional()
  @IsString()
  handlerPhone?: string;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;
}
