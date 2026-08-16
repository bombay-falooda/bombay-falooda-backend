import { IsOptional, IsString } from 'class-validator';

export class CreateKotDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
