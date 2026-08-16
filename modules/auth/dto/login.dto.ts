import { IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  emailOrPhone!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
