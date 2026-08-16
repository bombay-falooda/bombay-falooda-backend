import { IsNotEmpty, IsString } from 'class-validator';

export class CancelBillDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
