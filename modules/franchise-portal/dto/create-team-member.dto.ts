import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

type FranchiseTeamRole = 'STAFF' | 'POS_USER';

export class CreateTeamMemberDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(UserRole)
  role!: FranchiseTeamRole;

  @IsOptional()
  @IsString()
  outletId?: string;
}
