import { IsOptional, IsString } from 'class-validator';

export class UpdateUserAssignmentDto {
  @IsOptional()
  @IsString()
  franchiseId?: string | null;

  @IsOptional()
  @IsString()
  outletId?: string | null;
}
