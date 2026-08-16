import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

import { PosDeviceStatus, PosDeviceType } from '@app/common';

export class CreatePosDeviceDto {
  @IsString()
  outletId!: string;

  @IsString()
  name!: string;

  @IsEnum(PosDeviceType)
  type!: PosDeviceType;

  @IsOptional()
  @IsEnum(PosDeviceStatus)
  status?: PosDeviceStatus;

  @IsOptional()
  @IsString()
  accessKey?: string;

  @IsOptional()
  @IsString()
  @Length(4, 12)
  pin?: string;

  @IsOptional()
  @IsString()
  deviceCode?: string;

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
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
