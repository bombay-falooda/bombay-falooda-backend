import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

import { PosDeviceStatus, PosDeviceType } from '@app/common';

export class UpdatePosDeviceDto {
  @IsOptional()
  @IsString()
  outletId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(PosDeviceType)
  type?: PosDeviceType;

  @IsOptional()
  @IsEnum(PosDeviceStatus)
  status?: PosDeviceStatus;

  @IsOptional()
  @IsString()
  @Length(4, 12)
  pin?: string;

  @IsOptional()
  @IsString()
  deviceCode?: string | null;

  @IsOptional()
  @IsString()
  eventName?: string | null;

  @IsOptional()
  @IsString()
  eventLocation?: string | null;

  @IsOptional()
  @IsString()
  handlerName?: string | null;

  @IsOptional()
  @IsString()
  handlerPhone?: string | null;

  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @IsOptional()
  @IsDateString()
  validUntil?: string | null;
}
