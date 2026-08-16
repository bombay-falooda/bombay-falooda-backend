import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class BillPaymentInputDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  reference?: string;
}

export class FinalizeBillDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillPaymentInputDto)
  payments!: BillPaymentInputDto[];
}
