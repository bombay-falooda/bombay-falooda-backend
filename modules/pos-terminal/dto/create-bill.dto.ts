import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OrderType } from '@prisma/client';

import { BillItemInputDto } from './bill-item-input.dto';

export class CreateBillDto {
  @IsEnum(OrderType)
  type!: OrderType;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  notePrintEnabled?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillItemInputDto)
  items!: BillItemInputDto[];
}
