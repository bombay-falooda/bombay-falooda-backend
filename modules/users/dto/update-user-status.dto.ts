import { IsEnum } from 'class-validator';

import { UserStatus } from '@app/common';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
