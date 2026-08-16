import { IsBoolean } from 'class-validator';

export class UpdateFranchiseStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
