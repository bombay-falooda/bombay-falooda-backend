import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

import { UserRole } from '@app/common';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsString()
  franchiseId?: string;

  @IsOptional()
  @IsString()
  outletId?: string;

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
  @IsString()
  joiningDate?: string;
}

