import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateFranchiseDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  agreementStartDate?: string;

  @IsOptional()
  @IsString()
  agreementEndDate?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  securityDeposit?: string;

  @IsOptional()
  @IsString()
  royaltyPercent?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
