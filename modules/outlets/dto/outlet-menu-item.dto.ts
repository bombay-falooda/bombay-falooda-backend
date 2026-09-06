import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAddonDto {
  @IsString()
  name!: string;

  @IsNumber()
  price!: number;
}

export class CreateAddonGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  minSelect?: number;

  @IsOptional()
  @IsNumber()
  maxSelect?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddonDto)
  addons?: CreateAddonDto[];
}

export class CreateOutletMenuItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsNumber()
  price!: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetOutletIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetFranchiseIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  dineIn?: boolean;

  @IsOptional()
  @IsBoolean()
  takeaway?: boolean;

  @IsOptional()
  @IsBoolean()
  delivery?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddonGroupDto)
  addonGroups?: CreateAddonGroupDto[];
}

export class UpdateOutletMenuItemDto {
  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  dineIn?: boolean;

  @IsOptional()
  @IsBoolean()
  takeaway?: boolean;

  @IsOptional()
  @IsBoolean()
  delivery?: boolean;
}
