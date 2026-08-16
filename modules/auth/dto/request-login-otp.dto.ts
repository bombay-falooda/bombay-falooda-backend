import { IsString, MinLength } from 'class-validator';

export class RequestLoginOtpDto {
  @IsString()
  @MinLength(8)
  phone!: string;
}
