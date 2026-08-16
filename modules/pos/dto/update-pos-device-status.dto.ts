import { IsEnum } from 'class-validator';

import { PosDeviceStatus } from '@app/common';

export class UpdatePosDeviceStatusDto {
  @IsEnum(PosDeviceStatus)
  status!: PosDeviceStatus;
}
