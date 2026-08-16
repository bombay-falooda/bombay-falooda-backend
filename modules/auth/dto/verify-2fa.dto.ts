import { IsString, Length } from 'class-validator';

export class Verify2FaDto {
  @IsString()
  twoFactorToken!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}
