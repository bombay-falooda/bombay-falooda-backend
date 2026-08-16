import { IsEnum } from 'class-validator';

import { OutletStatus } from '@app/common';

export class UpdateOutletStatusDto {
  @IsEnum(OutletStatus)
  status!: OutletStatus;
}
