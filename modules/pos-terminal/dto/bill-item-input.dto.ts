import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BillItemAddonInputDto {
  @IsString()
  @IsNotEmpty()
  addonId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}

export class BillItemInputDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillItemAddonInputDto)
  @IsOptional()
  addons?: BillItemAddonInputDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
