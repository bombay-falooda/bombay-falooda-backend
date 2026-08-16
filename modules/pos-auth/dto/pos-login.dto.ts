import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PosLoginDto {
  @IsString()
  @IsNotEmpty()
  accessKey!: string;

  @IsString()
  @IsNotEmpty()
  pin!: string;

  @IsString()
  @IsOptional()
  deviceCode?: string;
}
