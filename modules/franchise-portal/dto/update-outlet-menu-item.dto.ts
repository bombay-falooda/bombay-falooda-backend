import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateOutletMenuItemDto {
  @IsString()
  outletId!: string;

  @IsString()
  itemId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
