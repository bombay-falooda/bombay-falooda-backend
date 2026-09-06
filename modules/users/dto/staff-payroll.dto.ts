import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateSalaryDto {
  @IsOptional()
  @IsNumber()
  salaryAmount?: number;

  @IsOptional()
  @IsString()
  salaryFrequency?: string;

  @IsOptional()
  @IsNumber()
  salaryPayDay?: number;

  @IsOptional()
  @IsString()
  salaryPaymentMethod?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;
}

export class MarkAttendanceDto {
  @IsDateString()
  date!: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
